# Segurança

Resumo do que foi implementado, item por item, e do que foi conscientemente
**não** implementado por não ser necessário.

## Chaves, segredos e git

- O site usa **apenas a chave pública** do Supabase (anon/publishable). Ela foi
  feita para ficar no navegador: quem protege os dados é a RLS.
- A chave `service_role` **não é usada** em lugar nenhum.
- Os valores reais ficam em `.env.local`, ignorado pelo git (`.env*` e `*.local`).
  O `env.local.example` passou a ter só valores fictícios.
- **Histórico do git verificado:** nenhum commit contém chaves (o
  `env.local.example` com valores reais nunca foi commitado). Não foi preciso
  reescrever o histórico.

## Banco de dados (Supabase)

- **RLS ativada em todas as tabelas**, com políticas explícitas (veja `BANCO_DE_DADOS.md`).
- **GRANTs explícitos**: o papel anônimo só lê produtos disponíveis, categorias e
  as configurações públicas. Nenhum acesso direto a pedidos.
- **Proteção contra mass assignment em duas camadas:**
  1. as Server Actions só leem campos conhecidos (lista fechada);
  2. o banco limita **por coluna** o que a dona pode alterar num pedido
     (situação, anotações, data/horário). Nem ela consegue mudar total, preço ou
     o segredo de consulta.
- Pedidos só entram por `create_order` (SECURITY DEFINER, `search_path` vazio):
  status sempre `pending`, preços e totais calculados com o catálogo oficial.
- **Consultas parametrizadas**: todo acesso passa pelo cliente do Supabase/PostgREST
  (parâmetros tipados) e por funções SQL com parâmetros tipados. Não há SQL
  dinâmico nem filtros montados com texto do usuário.

## Senhas e dados sensíveis

- **Senhas**: gerenciadas pelo Supabase Auth, que guarda só o hash (bcrypt).
  O projeto não tem tabela de senhas.
- **Código do pedido** aleatório (ex.: `7KQ4-M2XP`), não sequencial.
- **Criptografia**: o Supabase já criptografa o banco e os backups em disco
  (AES-256) e todo o tráfego (TLS). **Não** adicionamos criptografia de colunas
  (telefone/endereço) porque a dona precisa ler e buscar esses dados no painel,
  e a chave teria que ficar no próprio servidor: complexidade sem ganho real
  frente à RLS. Fica como opção futura (Supabase Vault) se houver exigência.
- Coletamos **só o necessário**: nome, telefone, endereço (apenas para entrega),
  data e observações.

## Autenticação e cookies

- **Autenticação no servidor**: `getUser()` valida o token no Supabase Auth a cada
  requisição do painel; a autorização (é admin?) é verificada no servidor em
  páginas, Server Actions e, de novo, na RLS. Esconder botões não é a proteção.
- **Cookies de sessão**: `httpOnly` (JavaScript não lê), `Secure` em produção,
  `SameSite=Lax`. Por isso o navegador nunca vê o token da dona: login, envio de
  fotos e dados do painel passam todos pelo servidor.
- Login com mensagem genérica (não revela se o e-mail existe) e limite de tentativas.
- Redirecionamento após links de e-mail restrito a rotas `/admin/...` (sem open redirect).

## Abuso, robôs e limites

- **Limite por cliente** (no banco, não dá para contornar pelo site):
  2 pedidos/dia e 5 a cada 7 dias por telefone. Cancelados/recusados não contam.
- **Limite geral** contra inundação: 60 pedidos a cada 10 minutos.
- **Limite por IP** (camada extra no servidor): pedidos, consultas e login.
- **Campo-armadilha (honeypot)** invisível no formulário para pegar robôs.
- **Pedidos duplicados**: botão bloqueia clique duplo e uma chave de idempotência
  faz o banco devolver o mesmo pedido em reenvios.
- **CAPTCHA não foi adicionado**: exigiria conta em serviço externo e piora a
  experiência de clientes com pouca familiaridade. As camadas acima bastam para
  o porte do negócio; se surgir spam, o Cloudflare Turnstile é o próximo passo.

## Consulta de pedido pelo telefone (decisão consciente)

Por escolha do responsável pelo projeto, o cliente acompanha o pedido digitando
**só o telefone**, que é mais fácil para ele. Foi apresentada a alternativa
"telefone + PIN de 4 dígitos", recusada em favor da simplicidade.

**Risco aceito:** quem souber o telefone de um cliente consegue ver os pedidos
dele. Para reduzir o que fica exposto:
- a consulta devolve só número do pedido, datas, situação, itens e valores:
  **nunca** nome, telefone, endereço ou observações;
- somente pedidos dos últimos 60 dias (no máximo 10);
- limite de 20 consultas a cada 10 minutos por IP no servidor.

Se no futuro for preciso mais proteção, dá para voltar ao modelo com PIN sem
mudar o banco: o segredo de cada pedido continua sendo gerado e guardado como hash.
A função antiga de consulta por código + chave foi retirada da API.

## Validação e vazamento de informação

- Validação no navegador (feedback) **e** no servidor **e** no banco (CHECKs + função).
- **Respostas enxutas**: as consultas pedem só as colunas necessárias. A consulta
  pública de pedidos não devolve nome, telefone, endereço nem observações.
- Mensagens de erro amigáveis, sem detalhes técnicos; logs sem dados pessoais
  (apenas códigos de erro).
- O telefone vai da confirmação para a página de consulta pelo `sessionStorage`
  (some ao fechar a aba), e não no endereço da página. A página usa
  `Referrer-Policy: no-referrer`.
- `/admin`, `/acompanhar` e a finalização ficam fora dos buscadores
  (`robots.txt` + `noindex`).

## Uploads

- Só a dona envia (RLS no Storage).
- Tipo verificado pelos **bytes do arquivo** (JPEG/PNG/WebP), não pelo nome.
- Máximo 5 MB (servidor e bucket). Nome do arquivo gerado pelo servidor.
- A foto é reduzida no aparelho e redesenhada, o que **remove metadados** como a
  localização GPS da câmera.

## Cabeçalhos HTTP e HTTPS

- `Content-Security-Policy` (scripts só do próprio site, imagens só do site e do
  Supabase, `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`).
- `Strict-Transport-Security` (HSTS, 2 anos), `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`. Cabeçalho `X-Powered-By` removido.
- **HTTPS forçado** em produção: o proxy redireciona `http` → `https` (308).

## Dependências

- Apenas **uma** dependência nova: `@supabase/ssr` (oficial do Supabase, para
  sessão em cookies). Nada de bibliotecas de UI, formulários ou validação.
- `verificar.cmd` roda `npm audit --omit=dev` e grava o resultado em `verificacao.log`.

## Painel em tempo real

O painel atualiza sozinho com uma checagem leve a cada 20 s (só com a aba aberta).
Não usamos o Supabase Realtime porque ele exigiria expor o token da dona ao
JavaScript do navegador, o que anularia a proteção dos cookies `httpOnly`.
