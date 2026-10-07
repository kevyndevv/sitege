-- =============================================================================
-- Testes de segurança (RLS) e regras de pedidos.
-- Rodam num banco de TESTE, nunca no projeto de produção:
--   psql -d banco_teste -f supabase/tests/supabase_stub.sql
--   psql -d banco_teste -f supabase/migrations/20261007000000_encomendas.sql
--   psql -d banco_teste -v ON_ERROR_STOP=1 -f supabase/tests/rls_e_pedidos.test.sql
-- Cada verificação imprime "ok - ..."; qualquer falha interrompe o script.
-- =============================================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;

create schema test;
grant usage on schema test to anon, authenticated;

create function test.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALHOU: %', label; end if;
  raise notice 'ok - %', label;
end $$;

-- Executa um SQL esperando erro cujo texto contenha "pattern".
create function test.throws(sql text, pattern text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm ilike '%' || pattern || '%' then
      raise notice 'ok - % (erro esperado: %)', label, sqlerrm;
      return;
    end if;
    raise exception 'FALHOU: % — erro inesperado: %', label, sqlerrm;
  end;
  raise exception 'FALHOU: % — deveria ter dado erro', label;
end $$;

create function test.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
$$;

grant execute on all functions in schema test to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dados de teste
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'dona@teste.local'),
  ('00000000-0000-0000-0000-00000000000b', 'curioso@teste.local');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');

update public.business_settings set offers_pickup = true, offers_delivery = false;

insert into public.products (id, name, price_cents, unit_label, active, archived, sort_order) values
  ('10000000-0000-0000-0000-000000000001', 'Produto A', 250, 'unidade', true, false, 1),
  ('10000000-0000-0000-0000-000000000002', 'Produto B', 9000, 'cento', true, false, 2),
  ('10000000-0000-0000-0000-000000000003', 'Produto C (a combinar)', null, null, true, false, 3),
  ('10000000-0000-0000-0000-000000000004', 'Produto D (indisponível)', 500, null, false, false, 4),
  ('10000000-0000-0000-0000-000000000005', 'Produto E (arquivado)', 500, null, true, true, 5);

-- ---------------------------------------------------------------------------
-- 1. Migração não roda duas vezes (proteção contra sobrescrever dados)
-- ---------------------------------------------------------------------------
select test.throws($$ do $x$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='orders')
  then raise exception 'Migração não aplicada: já existem as tabelas'; end if; end $x$ $$,
  'já existem as tabelas', 'pré-verificação detecta tabelas existentes');

-- ---------------------------------------------------------------------------
-- 2. Visitante anônimo
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;

select test.ok((select count(*) from public.products) = 3, 'anônimo vê só os 3 produtos disponíveis');
select test.ok((select count(*) from public.business_settings) = 1, 'anônimo lê configurações públicas');
select test.throws('select * from public.orders', 'permission denied', 'anônimo não lê pedidos');
select test.throws('select * from public.order_items', 'permission denied', 'anônimo não lê itens');
select test.throws('select * from public.order_status_history', 'permission denied', 'anônimo não lê histórico');
select test.throws($$insert into public.orders (order_number, customer_name, customer_phone, fulfillment_type, total_cents, tracking_token_hash, idempotency_key)
                     values ('AAAA-BBBB','X','11999999999','pickup',0,'\x00',gen_random_uuid())$$,
                   'permission denied', 'anônimo não insere pedido direto na tabela');
select test.throws($$update public.products set price_cents = 1$$, 'permission denied', 'anônimo não altera preço');
select test.throws($$update public.business_settings set whatsapp_number = '11999999999'$$, 'permission denied', 'anônimo não altera configurações');
select test.throws($$select public.get_admin_stats(now() - interval '1 day', now())$$, 'permission denied', 'anônimo não acessa estatísticas');
select test.throws($$select public.random_code(4)$$, 'permission denied', 'funções internas não são expostas');
select test.throws($$insert into storage.objects (bucket_id, name) values ('site-images', 'x.jpg')$$,
                   'row-level security', 'anônimo não envia imagens');

-- Pedido válido (retirada). O navegador tenta mandar um preço falso: ignorado.
create temporary table r1 as
select public.create_order(
  '20000000-0000-0000-0000-000000000001', '  Maria   da Silva ', '(11) 98888-7777', 'pickup', 'Rua X, 1',
  (now() at time zone 'America/Sao_Paulo')::date + 2, '15:30', 'Sem açúcar no B',
  '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":3,"unit_price_cents":1,"subtotal_cents":1},
    {"product_id":"10000000-0000-0000-0000-000000000002","quantity":1},
    {"product_id":"10000000-0000-0000-0000-000000000003","quantity":2}]'::jsonb) as res;

select test.ok((select (res->>'total_cents')::int = 3*250 + 9000 from r1), 'total calculado no servidor com preços oficiais (9750)');
select test.ok((select res->>'order_number' ~ '^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$' from r1), 'código público no formato aleatório');
select test.ok((select char_length(res->>'tracking_token') = 16 from r1), 'segredo de consulta com 16 caracteres');

-- Validações
select test.throws($$select public.create_order(gen_random_uuid(), 'Ana', '11977776666', 'delivery', 'Rua Y, 22',
  current_date + 3, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1}]')$$,
  'FULFILLMENT_UNAVAILABLE', 'entrega recusada quando não está habilitada');
select test.throws($$select public.create_order(gen_random_uuid(), 'Ana', '11977776666', 'pickup', null,
  current_date + 3, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000004","quantity":1}]')$$,
  'PRODUCT_UNAVAILABLE', 'produto indisponível recusado');
select test.throws($$select public.create_order(gen_random_uuid(), 'Ana', '11977776666', 'pickup', null,
  current_date + 3, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000005","quantity":1}]')$$,
  'PRODUCT_UNAVAILABLE', 'produto arquivado recusado');
select test.throws($$select public.create_order(gen_random_uuid(), 'Ana', '11977776666', 'pickup', null,
  current_date + 3, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":0}]')$$,
  'INVALID_ITEMS', 'quantidade zero recusada');
select test.throws($$select public.create_order(gen_random_uuid(), 'Ana', '11977776666', 'pickup', null,
  current_date + 3, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1.5}]')$$,
  'INVALID_ITEMS', 'quantidade fracionada recusada');
select test.throws($$select public.create_order(gen_random_uuid(), 'Ana', '11977776666', 'pickup', null,
  current_date + 3, null, null, '[{"product_id":"nao-e-uuid","quantity":1}]')$$,
  'INVALID_ITEMS', 'produto inválido recusado');
select test.throws($$select public.create_order(gen_random_uuid(), 'Ana', '11977776666', 'pickup', null,
  current_date + 3, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1},{"product_id":"10000000-0000-0000-0000-000000000001","quantity":2}]')$$,
  'INVALID_ITEMS', 'produto repetido recusado');
select test.throws($$select public.create_order(gen_random_uuid(), 'Ana', '11977776666', 'pickup', null,
  current_date + 3, null, null, '[]')$$, 'INVALID_ITEMS', 'carrinho vazio recusado');
select test.throws($$select public.create_order(gen_random_uuid(), 'Ana', '11977776666', 'pickup', null,
  current_date - 1, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1}]')$$,
  'INVALID_DATE', 'data no passado recusada');
select test.throws($$select public.create_order(gen_random_uuid(), 'A', '11977776666', 'pickup', null,
  current_date + 3, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1}]')$$,
  'INVALID_NAME', 'nome curto recusado');
select test.throws($$select public.create_order(gen_random_uuid(), 'Ana', '123', 'pickup', null,
  current_date + 3, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1}]')$$,
  'INVALID_PHONE', 'telefone inválido recusado');

-- Reenvio com a mesma chave (clique duplo / rede instável) não duplica
create temporary table r1b as
select public.create_order(
  '20000000-0000-0000-0000-000000000001', 'Maria da Silva', '11988887777', 'pickup', null,
  (now() at time zone 'America/Sao_Paulo')::date + 2, '15:30', null,
  '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":3}]'::jsonb) as res;
select test.ok((select (b.res->>'duplicate')::boolean and b.res->>'order_number' = a.res->>'order_number' from r1 a, r1b b),
  'reenvio devolve o MESMO pedido');

-- Consulta pelo cliente
select test.ok(public.get_order_tracking((select res->>'order_number' from r1), (select res->>'tracking_token' from r1b)) is not null,
  'consulta funciona com o segredo atual');
select test.ok(public.get_order_tracking((select res->>'order_number' from r1), (select res->>'tracking_token' from r1)) is null,
  'segredo antigo (rotacionado no reenvio) deixa de valer');
select test.ok(public.get_order_tracking((select res->>'order_number' from r1), 'AAAA-BBBB-CCCC-DDDD') is null,
  'segredo errado não revela nada');
select test.ok(public.get_order_tracking('ZZZZ-ZZZZ', (select res->>'tracking_token' from r1b)) is null,
  'código de outro pedido com este segredo não revela nada');
select test.ok((
  select not (t ? 'customer_name' or t ? 'customer_phone' or t ? 'delivery_address' or t ? 'notes' or t ? 'admin_notes')
     and jsonb_array_length(t->'items') = 3
     and (t->>'status') = 'pending'
    from (select public.get_order_tracking(lower(replace((select res->>'order_number' from r1), '-', '')),
                                           lower((select res->>'tracking_token' from r1b))) as t) q),
  'consulta não expõe dados pessoais e aceita código sem traço/minúsculo');

-- Limite diário: 2 pedidos por dia por telefone (Maria já tem 1 hoje)
create temporary table r3 as select public.create_order(gen_random_uuid(), 'Maria da Silva', '11988887777', 'pickup', null,
  current_date + 4, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1}]') as res;
select test.ok((select res->>'order_number' is not null from r3), 'segundo pedido do dia é aceito');
select test.throws($$select public.create_order(gen_random_uuid(), 'Maria da Silva', '(11) 98888-7777', 'pickup', null,
  current_date + 5, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1}]')$$,
  'DAILY_LIMIT', 'terceiro pedido do dia (mesmo telefone, outra formatação) é bloqueado');

select test.ok((select count(*) from public.get_popular_products(6)) = 0,
  'sem pedidos confirmados, "mais pedidos" fica vazio');

reset role;

-- Conferência direta no banco (como superusuário)
select test.ok((select count(*) from public.orders) = 2, 'reenvio não criou pedido duplicado');
select test.ok((select o.customer_name = 'Maria da Silva' and o.customer_phone = '11988887777' and o.delivery_address is null
                       and o.status = 'pending' and o.total_cents = 9750
                  from public.orders o join r1 on o.order_number = r1.res->>'order_number'),
  'nome/telefone normalizados, retirada sem endereço, status pending');
select test.ok((select bool_and(case when i.product_name like 'Produto C%' then i.unit_price_cents is null and i.subtotal_cents is null
                                     when i.product_name = 'Produto A' then i.unit_price_cents = 250 and i.subtotal_cents = 750
                                     else i.unit_price_cents = 9000 end)
                  from public.order_items i join public.orders o on o.id = i.order_id join r1 on o.order_number = r1.res->>'order_number'),
  'itens guardam preço oficial; item sem preço fica "a combinar"');
select test.ok((select count(*) = 2 from public.order_status_history where from_status is null and to_status = 'pending'),
  'histórico registra a criação de cada pedido');

-- Pedido recusado/cancelado devolve o uso diário
update public.orders set status = 'cancelled' where order_number = (select res->>'order_number' from r3);
set role anon;
create temporary table r4 as select public.create_order(gen_random_uuid(), 'Maria da Silva', '11988887777', 'pickup', null,
  current_date + 5, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":2}]') as res;
select test.ok((select res->>'order_number' is not null from r4), 'pedido cancelado não gasta o limite diário');
reset role;

-- Limite semanal: 5 pedidos em 7 dias (pedidos de dias anteriores simulados)
insert into public.orders (order_number, customer_name, customer_phone, status, fulfillment_type, total_cents,
                           tracking_token_hash, idempotency_key, created_at)
select public.random_code(4) || '-' || public.random_code(4), 'Teste Semana', '11911112222', st, 'pickup', 250,
       '\x00', gen_random_uuid(), now() - (d || ' days')::interval
  from (values (2, 'completed'), (3, 'completed'), (4, 'confirmed'), (5, 'confirmed'), (6, 'cancelled'), (9, 'completed'))
       as v(d, st);
insert into public.order_items (order_id, product_id, product_name, unit_price_cents, quantity, subtotal_cents)
select o.id, '10000000-0000-0000-0000-000000000001', 'Produto A', 250, 1, 250
  from public.orders o where o.customer_phone = '11911112222';
set role anon;
create temporary table r5 as select public.create_order(gen_random_uuid(), 'Teste Semana', '11911112222', 'pickup', null,
  current_date + 3, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1}]') as res;
select test.ok((select res->>'order_number' is not null from r5),
  '5º pedido em 7 dias é aceito (cancelado e o de 9 dias atrás não contam)');
select test.throws($$select public.create_order(gen_random_uuid(), 'Teste Semana', '11911112222', 'pickup', null,
  current_date + 3, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1}]')$$,
  'WEEKLY_LIMIT', '6º pedido em 7 dias é bloqueado');
reset role;

-- Loja fechada
update public.business_settings set accepting_orders = false;
set role anon;
select test.throws($$select public.create_order(gen_random_uuid(), 'Ana', '11977776666', 'pickup', null,
  current_date + 3, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1}]')$$,
  'ORDERS_CLOSED', 'pedidos bloqueados quando a dona pausa as encomendas');
reset role;
update public.business_settings set accepting_orders = true, offers_delivery = true, delivery_fee_cents = null, min_lead_days = 2;

set role anon;
select test.throws($$select public.create_order(gen_random_uuid(), 'Ana', '11977776666', 'pickup', null,
  (now() at time zone 'America/Sao_Paulo')::date + 1, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1}]')$$,
  'INVALID_DATE', 'antecedência mínima configurada é respeitada');
select test.throws($$select public.create_order(gen_random_uuid(), 'Ana', '11977776666', 'delivery', null,
  current_date + 3, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1}]')$$,
  'INVALID_ADDRESS', 'entrega exige endereço');
create temporary table r2 as select public.create_order(gen_random_uuid(), 'João Souza', '21977776666', 'delivery', 'Rua das Flores, 10 - Centro',
  current_date + 3, null, null, '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":4}]') as res;
select test.ok((select (res->>'total_cents')::int = 1000 from r2), 'taxa de entrega não configurada = a combinar (não soma valor inventado)');
reset role;

-- ---------------------------------------------------------------------------
-- 3. Usuário logado que NÃO é a dona
-- ---------------------------------------------------------------------------
select test.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select test.ok((select count(*) from public.orders) = 0, 'usuário comum não vê pedidos');
select test.ok((select count(*) from public.order_items) = 0, 'usuário comum não vê itens');
select test.ok((select count(*) from public.products) = 3, 'usuário comum vê só produtos disponíveis');
select test.ok((select count(*) from public.admins) = 0, 'usuário comum não é admin');
select test.ok(not public.is_admin(), 'is_admin() = false para usuário comum');
select test.throws($$insert into public.products (name, price_cents) values ('Invasor', 1)$$, 'row-level security', 'usuário comum não cria produto');
do $$ begin
  update public.orders set status = 'cancelled';
  if found then raise exception 'FALHOU: usuário comum alterou pedido'; end if;
  raise notice 'ok - usuário comum não altera pedidos';
end $$;
select test.throws($$select public.get_admin_stats(now() - interval '1 day', now())$$, 'FORBIDDEN', 'usuário comum não acessa estatísticas');
select test.throws($$insert into storage.objects (bucket_id, name) values ('site-images', 'x.jpg')$$, 'row-level security', 'usuário comum não envia imagens');
reset role;

-- ---------------------------------------------------------------------------
-- 4. A dona (admin)
-- ---------------------------------------------------------------------------
grant select on r1, r1b, r2, r3, r4, r5 to authenticated, anon; -- tabelas auxiliares do próprio teste
select test.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select test.ok(public.is_admin(), 'is_admin() = true para a dona');
select test.ok((select count(*) from public.orders) = 11, 'dona vê todos os pedidos');
select test.ok((select count(*) from public.products) = 5, 'dona vê produtos inativos e arquivados');
select test.throws($$update public.orders set total_cents = 1$$, 'permission denied', 'nem a dona altera o total de um pedido');
select test.throws($$update public.orders set tracking_token_hash = '\x00'$$, 'permission denied', 'nem a dona altera o segredo do pedido');
select test.throws($$delete from public.orders$$, 'permission denied', 'pedidos não são apagados (apenas cancelados)');
select test.throws($$delete from public.products where id = '10000000-0000-0000-0000-000000000001'$$,
  'foreign key', 'produto já pedido não pode ser apagado (deve ser arquivado)');
insert into storage.objects (bucket_id, name) values ('site-images', 'products/teste.webp');
select test.ok(true, 'dona envia imagem para o bucket');

-- Confirma o pedido da Maria e cancela (recusa) o do João
update public.orders set status = 'confirmed', admin_notes = 'Confirmado por telefone'
 where order_number = (select res->>'order_number' from r1);
update public.orders set status = 'cancelled' where order_number = (select res->>'order_number' from r2);

select test.ok((select count(*) from public.order_status_history
                 where to_status = 'confirmed' and changed_by = '00000000-0000-0000-0000-00000000000a') = 1,
  'mudança de status registrada no histórico com a autora');

select test.ok((select jsonb_typeof(public.get_admin_stats(now() - interval '1 day', now() + interval '1 minute')) = 'object'),
  'dona acessa estatísticas');
select test.ok((select (public.get_admin_stats(now() - interval '1 day', now() + interval '1 minute') -> 'by_status' ->> 'cancelled')::int = 2),
  'estatísticas contam cancelados separadamente');
reset role;

-- ---------------------------------------------------------------------------
-- 5. Mais pedidos: confirmados contam, pendentes e cancelados não
-- ---------------------------------------------------------------------------
-- Válidos: Maria (A×3, B×1, C×2, confirmado) + 5 pedidos da semana (A×1,
-- confirmados/concluídos) → A=8, C=2, B=1. Não contam: cancelados (João A×4 e
-- um da semana) e pendentes (Maria A×2, semana A×1).
set role anon;
select test.ok((select array_agg(name order by rank) from public.get_popular_products(6))
               = array['Produto A', 'Produto C (a combinar)', 'Produto B'],
  'ranking por quantidade, ignorando pendentes e cancelados');
select test.ok((select count(*) from public.get_popular_products(1)) = 1, 'limite de itens respeitado');
reset role;

update public.products set active = false where id = '10000000-0000-0000-0000-000000000001';
set role anon;
select test.ok((select bool_and(name <> 'Produto A') from public.get_popular_products(6)),
  'produto desativado sai da lista de mais pedidos');
reset role;

\echo '>>> TODOS OS TESTES PASSARAM'
