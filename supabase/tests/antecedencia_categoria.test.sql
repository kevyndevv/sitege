-- Testes da antecedência por categoria. Rodar depois dos outros testes e da
-- migração 20261008000000 (reaproveita o schema "test").
\set ON_ERROR_STOP 1
reset role;
update public.business_settings set accepting_orders = true, offers_pickup = true, min_lead_days = 1;
insert into public.categories (id, name, min_lead_days) values
  ('50000000-0000-0000-0000-0000000000c1', 'Bolos (teste)', 3),
  ('50000000-0000-0000-0000-0000000000c2', 'Docinhos (teste)', null);
insert into public.products (id, name, price_cents, category_id) values
  ('50000000-0000-0000-0000-000000000001', 'Bolo teste', 5000, '50000000-0000-0000-0000-0000000000c1'),
  ('50000000-0000-0000-0000-000000000002', 'Brigadeiro teste', 200, '50000000-0000-0000-0000-0000000000c2'),
  ('50000000-0000-0000-0000-000000000003', 'Sem categoria teste', 300, null);

select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;
select test.ok((select min_lead_days = 3 from public.categories where name = 'Bolos (teste)'),
  'público vê a antecedência da categoria');

-- Só docinho: vale a geral (1 dia)
select test.throws($$select public.create_order(gen_random_uuid(), 'Cliente Prazo', '48966660001', 'pickup', null,
  (now() at time zone 'America/Sao_Paulo')::date, null, null,
  '[{"product_id":"50000000-0000-0000-0000-000000000002","quantity":1}]')$$,
  'INVALID_DATE', 'sem antecedência da categoria, vale a geral (1 dia)');
create temporary table a1 as select public.create_order(gen_random_uuid(), 'Cliente Prazo', '48966660001', 'pickup', null,
  (now() at time zone 'America/Sao_Paulo')::date + 1, null, null,
  '[{"product_id":"50000000-0000-0000-0000-000000000002","quantity":1}]') as res;
select test.ok((select res ? 'order_number' from a1), 'docinho para amanhã é aceito');

-- Bolo + docinho: vale a MAIOR (3 dias)
select test.throws($$select public.create_order(gen_random_uuid(), 'Cliente Prazo 2', '48966660002', 'pickup', null,
  (now() at time zone 'America/Sao_Paulo')::date + 2, null, null,
  '[{"product_id":"50000000-0000-0000-0000-000000000001","quantity":1},{"product_id":"50000000-0000-0000-0000-000000000002","quantity":1}]')$$,
  'INVALID_DATE', 'bolo + docinho com 2 dias é recusado (vale a maior: 3)');
create temporary table a2 as select public.create_order(gen_random_uuid(), 'Cliente Prazo 2', '48966660002', 'pickup', null,
  (now() at time zone 'America/Sao_Paulo')::date + 3, null, null,
  '[{"product_id":"50000000-0000-0000-0000-000000000001","quantity":1},{"product_id":"50000000-0000-0000-0000-000000000002","quantity":1}]') as res;
select test.ok((select res ? 'order_number' from a2), 'bolo + docinho com 3 dias é aceito');
reset role;

-- Geral maior que a da categoria: vale a geral
update public.business_settings set min_lead_days = 5;
set role anon;
select test.throws($$select public.create_order(gen_random_uuid(), 'Cliente Prazo 3', '48966660003', 'pickup', null,
  (now() at time zone 'America/Sao_Paulo')::date + 4, null, null,
  '[{"product_id":"50000000-0000-0000-0000-000000000001","quantity":1}]')$$,
  'INVALID_DATE', 'geral (5) maior que a da categoria (3): vale 5');
select test.throws($$select public.create_order(gen_random_uuid(), 'Cliente Prazo 3', '48966660003', 'pickup', null,
  (now() at time zone 'America/Sao_Paulo')::date + 4, null, null,
  '[{"product_id":"50000000-0000-0000-0000-000000000003","quantity":1}]')$$,
  'INVALID_DATE', 'produto sem categoria segue a geral');
select test.throws($$update public.categories set min_lead_days = 0$$, 'permission denied',
  'público não altera a antecedência');
reset role;

-- Dona altera; valores fora de 0..60 são recusados
select test.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
update public.categories set min_lead_days = 7 where id = '50000000-0000-0000-0000-0000000000c2';
select test.ok((select min_lead_days = 7 from public.categories where id = '50000000-0000-0000-0000-0000000000c2'),
  'dona define a antecedência da categoria');
select test.throws($$update public.categories set min_lead_days = 61 where id = '50000000-0000-0000-0000-0000000000c2'$$,
  'check', 'antecedência acima de 60 dias é recusada');
reset role;
select test.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
update public.categories set min_lead_days = 0;
reset role;
select test.ok((select min_lead_days = 7 from public.categories where id = '50000000-0000-0000-0000-0000000000c2'),
  'usuário comum não consegue alterar (RLS)');

update public.business_settings set min_lead_days = null;
\echo '>>> ANTECEDÊNCIA POR CATEGORIA: TODOS OS TESTES PASSARAM'
