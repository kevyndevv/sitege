# Banco de dados

Migrações (em ordem, todas não destrutivas):
1. `20261007000000_encomendas.sql`: estrutura principal (roda numa transação e
   para se encontrar tabelas com os mesmos nomes).
2. `20261007010000_restringe_tabelas_antigas.sql`: as tabelas antigas
   `clientes`/`pedidos` (vazias, sem uso) passam a aceitar só a administradora.
3. `20261007020000_consulta_por_telefone.sql`: consulta de pedidos pelo telefone.
4. `20261007030000_locais_de_entrega.sql`: locais de entrega com taxa própria
   (tabela `delivery_zones`, coluna `orders.delivery_zone_name`) e nova versão de
   `create_order` que calcula o frete pelo local escolhido.
5. `20261007040000_excluir_produto_de_pedidos_cancelados.sql`: produto que só
   aparece em pedidos cancelados pode ser excluído (o item do pedido mantém nome e
   preço); produto em pedido válido continua protegido por gatilho.

## Tabelas

| Tabela | Para quê | Observações |
|---|---|---|
| `admins` | quem é administradora | só `user_id` → `auth.users`. Sem senhas. |
| `categories` | organizar o cardápio | opcional; nome único (sem diferenciar maiúsculas) |
| `products` | catálogo | `price_cents` inteiro (NULL = a combinar), `unit_label`, `image_path` (caminho no Storage), `active` (disponível), `archived` (fora do cardápio, preservado), `sort_order` |
| `orders` | pedidos | `order_number` aleatório, `status`, `fulfillment_type`, endereço só para entrega, `requested_date` + `requested_time`, `delivery_fee_cents` (NULL = a combinar), `total_cents`, `tracking_token_hash` (SHA-256), `idempotency_key` |
| `order_items` | itens do pedido | guarda **nome, unidade e preço do momento** da compra; `subtotal_cents` consistente por CHECK |
| `order_status_history` | auditoria | preenchida por gatilho a cada criação/mudança de situação, com quem alterou |
| `delivery_zones` | locais de entrega e taxa de cada um | público vê só os ativos; a taxa do pedido sempre vem daqui (nunca do navegador) |
| `business_settings` | configurações do site | uma única linha; tudo começa vazio (nada inventado) |

Ajustes em relação à sugestão inicial:
- `requested_at` virou `requested_date` (date) + `requested_time` (time, opcional):
  representa melhor "para o dia X, às Y h" sem confusão de fuso horário.
- `price` virou `price_cents` (nome explícito) e aceita NULL para "a combinar".
- `profiles` virou `admins`: só precisamos saber quem é a dona.

### Integridade
- UUID em todos os IDs internos; dinheiro e quantidades em **inteiros**.
- Chaves estrangeiras: item → pedido (`cascade`), item → produto (`set null`; um
  gatilho impede apagar produto que está em pedido não cancelado, que deve ser
  arquivado), produto → categoria (`set null`).
- CHECKs de tamanho/formato em todos os textos, telefone só com dígitos,
  entrega exige endereço e retirada não guarda endereço.

### Índices (apenas os usados)
- `orders (created_at desc)`: lista do painel e filtros por período.
- `orders (status, created_at desc)`: filtros por situação e cálculo de mais pedidos.
- `orders (customer_phone, created_at desc)`: limites por cliente.
- `orders (updated_at desc)`: detecção de mudanças no painel.
- `order_items (order_id)`, `order_items (product_id)`, `order_status_history (order_id, created_at)`.
- `products (sort_order, name) where active and not archived`: cardápio público.

## Funções

| Função | Quem chama | O que faz |
|---|---|---|
| `create_order(...)` | público (via servidor) | valida tudo, aplica limites, calcula preços/totais, grava pedido + itens numa transação, devolve código + chave de consulta |
| `get_orders_by_phone(telefone)` | público | pedidos dos últimos 60 dias (máx. 10) daquele telefone: só situação, datas, itens e valores |
| `get_order_tracking(código, chave)` | ninguém (retirada da API) | modelo antigo de consulta, mantido só no banco |
| `get_popular_products(limite)` | público | ranking de mais pedidos (sem números de vendas) |
| `get_admin_stats(de, até)` | admin | contagens por situação, valor e produtos mais pedidos |
| `is_admin()` | políticas RLS | a pessoa logada está em `admins`? |

Todas as funções `SECURITY DEFINER` usam `set search_path = ''` e nomes
totalmente qualificados. Funções internas (`random_code`, `normalize_code`,
gatilhos) não podem ser chamadas pela API.

### Limites por cliente (`create_order`)
- Cliente = telefone normalizado (só dígitos).
- **2 pedidos por dia** (dia corrente, horário de Brasília) e **5 nos últimos 7 dias**.
- Contam pedidos em qualquer situação **exceto `cancelled`**. Se a dona recusar
  ou cancelar, o cliente recupera o uso.
- Limite geral de 60 pedidos a cada 10 minutos (proteção contra robôs).

### Mais pedidos
Conta só pedidos `confirmed`, `preparing`, `ready`, `completed`. Pendentes ficam
de fora porque ainda não foram aceitos (e qualquer pessoa poderia inflar a lista
com pedidos falsos). Cancelados nunca contam. A seção aparece a partir de 3
pedidos confirmados. A página inicial guarda o resultado em cache por até 60 s e
é atualizada na hora quando a dona muda a situação de um pedido.

## Políticas RLS

| Tabela | anon | authenticated (não admin) | admin |
|---|---|---|---|
| `admins` | — | vê a própria linha (vazia) | vê a própria linha |
| `categories` | ler | ler | ler/criar/alterar/excluir |
| `products` | ler disponíveis | ler disponíveis | tudo |
| `orders` | — | — | ler; alterar só `status`, `admin_notes`, `requested_date`, `requested_time` |
| `order_items` | — | — | ler |
| `order_status_history` | — | — | ler (gravação só pelo gatilho) |
| `business_settings` | ler | ler | ler/alterar (colunas listadas) |
| `delivery_zones` | ler ativos | ler ativos | tudo |
| `storage.objects` (`site-images`) | leitura pública dos arquivos | — | enviar/substituir/apagar |

Ninguém apaga pedidos pela API (cancela-se). Inclusão de administradoras só pelo
SQL Editor.

## Storage

Bucket `site-images`, público para leitura, limite 5 MB, tipos `image/jpeg`,
`image/png`, `image/webp`. Pastas: `products/` e `site/`. Se precisar criar pelo
painel do Supabase, use estas políticas em `storage.objects` (para o papel
`authenticated`): SELECT, INSERT, UPDATE e DELETE com a condição
`bucket_id = 'site-images' and (select public.is_admin())`.

## Testes

`supabase/tests/rls_e_pedidos.test.sql` cobre 69 verificações (RLS para anônimo,
usuário comum e dona; cálculo de valores; preço falso ignorado; limites diário
e semanal; cancelado devolvendo o limite; idempotência; consulta segura;
ranking). Roda num Postgres de teste com `supabase/tests/supabase_stub.sql`,
que imita as partes do Supabase usadas. **Nunca rode os testes no projeto real.**
