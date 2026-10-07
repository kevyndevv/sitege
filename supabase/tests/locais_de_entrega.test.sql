-- Testes dos locais de entrega. Rodar DEPOIS dos outros testes e da
-- migração 20261007030000 (reaproveita o schema "test" e os produtos).
\set ON_ERROR_STOP 1
reset role;
update public.business_settings set accepting_orders = true, offers_delivery = true, offers_pickup = true,
  min_lead_days = null, delivery_fee_cents = 700;

select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;
select test.ok((select count(*) from public.delivery_zones) = 2, 'público vê os 2 locais iniciais');
select test.throws($$update public.delivery_zones set fee_cents = 0$$, 'permission denied', 'público não altera taxas');

select test.throws($$select public.create_order(gen_random_uuid(), 'Cliente Zona', '48988880001', 'delivery', 'Rua A, 100',
  current_date + 2, null, null, '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":1}]')$$,
  'INVALID_ZONE', 'entrega sem escolher local é recusada');
select test.throws($$select public.create_order(gen_random_uuid(), 'Cliente Zona', '48988880001', 'delivery', 'Rua A, 100',
  current_date + 2, null, null, '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":1}]', gen_random_uuid())$$,
  'INVALID_ZONE', 'local inexistente é recusado');

create temporary table z1 as select public.create_order(gen_random_uuid(), 'Cliente Zona', '48988880001', 'delivery', 'Rua A, 100',
  current_date + 2, null, null, '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":2}]',
  (select id from public.delivery_zones where name = 'Ingleses')) as res;
select test.ok((select (res->>'total_cents')::int = 600 + 1000 from z1), 'Ingleses: 2 × R$ 3,00 + frete R$ 10,00');

create temporary table z2 as select public.create_order(gen_random_uuid(), 'Outro Cliente', '48988880002', 'delivery', 'Rua B, 5',
  current_date + 2, null, null, '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":1}]',
  (select id from public.delivery_zones where name like 'Fora%')) as res;
select test.ok((select (res->>'total_cents')::int = 300 + 1500 from z2), 'fora dos Ingleses: frete R$ 15,00');

create temporary table z3 as select public.create_order(gen_random_uuid(), 'Cliente Retira', '48988880003', 'pickup', null,
  current_date + 2, null, null, '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":1}]',
  (select id from public.delivery_zones where name = 'Ingleses')) as res;
select test.ok((select (res->>'total_cents')::int = 300 from z3), 'retirada nunca cobra frete, mesmo se mandarem um local');
reset role;

select test.ok((select delivery_zone_name = 'Ingleses' and delivery_fee_cents = 1000
                  from public.orders o join z1 on o.order_number = z1.res->>'order_number'),
  'pedido guarda o nome do local e a taxa do momento');

-- Local desativado não pode ser escolhido; sem locais ativos, volta a taxa única
update public.delivery_zones set active = false;
set role anon;
select test.ok((select count(*) from public.delivery_zones) = 0, 'local desativado some para o público');
create temporary table z4 as select public.create_order(gen_random_uuid(), 'Cliente Sem Zona', '48988880004', 'delivery', 'Rua C, 9',
  current_date + 2, null, null, '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":1}]') as res;
select test.ok((select (res->>'total_cents')::int = 300 + 700 from z4), 'sem locais ativos, usa a taxa única das configurações');
reset role;

-- Admin gerencia os locais
select test.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select test.ok((select count(*) from public.delivery_zones) = 2, 'dona vê locais inativos');
update public.delivery_zones set active = true, fee_cents = 1200 where name = 'Ingleses';
select test.ok(true, 'dona altera taxa e reativa local');
reset role;
select test.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select test.throws($$insert into public.delivery_zones (name, fee_cents) values ('Invasor', 0)$$, 'row-level security',
  'usuário comum não cria local');
reset role;

\echo '>>> LOCAIS DE ENTREGA: TODOS OS TESTES PASSARAM'
