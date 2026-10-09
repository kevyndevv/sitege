# Site de encomendas — doces e salgados

Site onde clientes fazem encomendas **sem criar conta**, acompanham o pedido com
o telefone usado no pedido, e a dona gerencia tudo por um **painel protegido**.

- **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS 4**
- **Supabase**: Postgres, Auth (login da dona) e Storage (fotos)
- Cor principal da identidade: `#75616b`

> O arquivo `site-local.html` (painel antigo que salvava no navegador) foi
> mantido sem alterações. Ele não é usado pelo site novo.

---

## 1. Configurar o Supabase (uma vez)

1. Abra o projeto em <https://supabase.com/dashboard> → **SQL Editor** → **New query**.
2. Rode, **nesta ordem**, cada arquivo de `supabase/migrations/` (cole o conteúdo e clique em **Run**):
   `20261007000000_encomendas.sql`, `20261007010000_restringe_tabelas_antigas.sql`
   (só se existirem as tabelas antigas `clientes`/`pedidos`), `20261007020000_consulta_por_telefone.sql`
   `20261007030000_locais_de_entrega.sql`, `20261007040000_excluir_produto_de_pedidos_cancelados.sql`
   e `20261008000000_antecedencia_por_categoria.sql`.
   - A migração **não apaga nada**. Se já existir alguma tabela com o mesmo nome,
     ela para no início, explica o motivo e não aplica nada.
3. Crie a conta da dona: **Authentication → Users → Add user → Create new user**
   (e-mail + senha forte, marque *Auto Confirm User*).
4. Autorize essa conta como administradora (SQL Editor):

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'email-da-dona@exemplo.com';
   ```

5. Recomendado em **Authentication**:
   - **Sign In / Providers → Email**: desative *Allow new users to sign up*
     (ninguém precisa se cadastrar; só a dona tem conta).
   - **URL Configuration**: em *Site URL* coloque o endereço do site e, em
     *Redirect URLs*, adicione `https://SEU-SITE/admin/auth/callback`
     (e `http://localhost:3000/admin/auth/callback` para testes). Isso faz o
     “Esqueci minha senha” funcionar.
   - **Policies → Password**: tamanho mínimo 10 e “leaked password protection”, se disponível.

Se a migração mostrar o aviso sobre o Storage, crie pelo painel um bucket
**público** chamado `site-images` (limite 5 MB, tipos `image/jpeg, image/png, image/webp`)
e as políticas descritas em `docs/BANCO_DE_DADOS.md`.

## 2. Variáveis de ambiente

As chaves ficam **somente** em `.env.local` (ignorado pelo git). Modelo em `env.local.example`:

| Variável | Para quê | Exemplo (fictício) |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto | `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave **pública** anon/publishable | `eyJhbGciOi...` ou `sb_publishable_...` |
| `NEXT_PUBLIC_SITE_URL` (opcional) | endereço público, usado no e-mail de redefinição de senha | `https://www.exemplo.com.br` |

A chave `service_role`/secret **não é usada** e nunca deve ser colocada no projeto.

## 3. Rodar no computador

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>. A área da dona fica em <http://localhost:3000/admin>.

Para conferir tudo de uma vez no Windows, dê dois cliques em **`verificar.cmd`**:
ele instala as dependências, roda `npm audit`, verificação de tipos, lint e build,
e grava o resultado em `verificacao.log`.

## 4. Primeiros passos da dona (pelo painel)

1. **Configurações**: nome do negócio, WhatsApp, Instagram, se faz **retirada**
   e/ou **entrega** (sem marcar uma das duas, o site não aceita pedidos), locais de
   entrega com a taxa de cada um, antecedência mínima geral, foto da página inicial.
2. **Produtos**: cadastrar com foto, preço (ou “a combinar”) e categoria. Em
   **Categorias**, dá para definir a antecedência de cada uma (ex.: Bolos = 3 dias).
3. Os pedidos chegam em **Pedidos** e o painel avisa sozinho quando entra um novo.

## 5. Regras de negócio

- **Limite por cliente** (pelo telefone): até **2 pedidos por dia** e **5 a cada
  7 dias**. Pedidos **recusados/cancelados não contam**, então o cliente recupera o uso.
- **Mais pedidos** (página inicial): soma das quantidades dos pedidos já
  **confirmados** pela dona (confirmado, em preparação, pronto, concluído).
  Pendentes e cancelados não contam. Aparece a partir de 3 pedidos confirmados.
  Desempate: nº de pedidos e depois nome.
- Preços e totais são **sempre calculados no banco**, com o preço oficial do produto.
- O pedido guarda nome e preço do produto **no momento da compra**.
- **Acompanhar pedido**: o cliente digita o **telefone** usado no pedido e vê os
  pedidos dos últimos 60 dias (situação, itens, valores). Quando o pedido fica
  **pronto**, a página mostra um aviso em destaque.
- **Antecedência**: existe a geral (Configurações) e a de cada categoria. Num
  pedido com itens de categorias diferentes, vale a **maior**. Ex.: geral 1 dia,
  Bolos 3 dias → pedido com bolo e docinho só pode ser para daqui a 3 dias. O
  calendário da finalização já bloqueia os dias antes do prazo, e o banco confere tudo.
- **Frete por local**: a dona cadastra locais e taxas em Configurações (começa com
  "Ingleses" R$ 10 e "Fora dos Ingleses (região)" R$ 15). O cliente escolhe o local
  ao pedir entrega; o banco calcula a taxa. Sem locais ativos, a taxa fica "a combinar".
- **Modo noturno**: botão de lua/sol no topo do site e do painel. A escolha fica
  salva no aparelho; sem escolha, segue o modo do celular/computador.

## 6. Testes

- Banco (RLS, limites, cálculo de valores, consulta segura): veja
  os arquivos em `supabase/tests/` (incluindo `antecedencia_categoria.test.sql`)
  (rodam num Postgres de teste, nunca em produção).
- Aplicação: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Documentação

- `docs/SEGURANCA.md`: o que foi feito em segurança e por quê.
- `docs/BANCO_DE_DADOS.md`: tabelas, funções, políticas RLS e decisões.
