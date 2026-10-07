-- Testes da consulta por telefone. Rodar DEPOIS de rls_e_pedidos.test.sql
-- (reaproveita o schema "test") e da migração 20261007020000.
\set ON_ERROR_STOP 1

insert into public.products (id, name, price_cents, active) values
  ('30000000-0000-0000-0000-000000000001', 'Produto Telefone', 300, true);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;
create temporary table t1 as select public.create_order(gen_random_uuid(), 'Cliente Telefone', '(21) 97777-1234', 'pickup', null,
  current_date + 3, '10:00', 'segredo do bolo', '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":2}]') as res;
reset role;
grant select on t1 to anon, authenticated;

-- Pedido antigo (fora da janela de 60 dias) do mesmo telefone
insert into public.orders (order_number, customer_name, customer_phone, status, fulfillment_type, total_cents,
                           tracking_token_hash, idempotency_key, created_at)
values ('ZZZZ-9999', 'Cliente Telefone', '21977771234', 'completed', 'pickup', 100, '\x00', gen_random_uuid(), now() - interval '90 days');

set role anon;
select test.ok(jsonb_array_length(public.get_orders_by_phone('(21) 97777-1234')) = 1, 'acha o pedido pelo telefone formatado');
select test.ok(jsonb_array_length(public.get_orders_by_phone('5521977771234')) = 1, 'acha também com o 55 na frente');
select test.ok(jsonb_array_length(public.get_orders_by_phone('21977770000')) = 0, 'outro telefone não vê nada');
select test.ok(jsonb_array_length(public.get_orders_by_phone('abc')) = 0, 'telefone inválido devolve lista vazia');
select test.ok((select bool_and(not (o ? 'customer_name' or o ? 'customer_phone' or o ? 'delivery_address' or o ? 'notes' or o ? 'admin_notes'))
                  from jsonb_array_elements(public.get_orders_by_phone('21977771234')) o),
  'não expõe nome, telefone, endereço nem observações');
select test.ok((select o->>'order_number' = (select res->>'order_number' from t1) and (o->>'total_cents')::int = 600
                  from jsonb_array_elements(public.get_orders_by_phone('21977771234')) o),
  'traz número, itens e total corretos; pedido de 90 dias atrás fica de fora');
select test.throws($$select public.get_order_tracking('AAAA-BBBB', 'AAAABBBBCCCCDDDD')$$, 'permission denied',
  'consulta antiga por código+chave não está mais exposta');
reset role;

\echo '>>> CONSULTA POR TELEFONE: TODOS OS TESTES PASSARAM'
