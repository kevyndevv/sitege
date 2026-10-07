-- Testes de exclusão de produto. Rodar depois dos outros testes e da migração 20261007040000.
\set ON_ERROR_STOP 1
reset role;
insert into public.products (id, name, price_cents, active, archived) values
  ('40000000-0000-0000-0000-000000000001', 'Só em cancelado', 500, true, false),
  ('40000000-0000-0000-0000-000000000002', 'Em pedido válido', 500, true, false);

select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;
create temporary table e1 as select public.create_order(gen_random_uuid(), 'Teste Exclusão', '48977770001', 'pickup', null,
  current_date + 2, null, null, '[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":1}]') as res;
create temporary table e2 as select public.create_order(gen_random_uuid(), 'Teste Exclusão 2', '48977770002', 'pickup', null,
  current_date + 2, null, null, '[{"product_id":"40000000-0000-0000-0000-000000000002","quantity":1}]') as res;
reset role;
update public.orders set status = 'cancelled' where order_number = (select res->>'order_number' from e1);
update public.orders set status = 'completed' where order_number = (select res->>'order_number' from e2);

select test.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
delete from public.products where id = '40000000-0000-0000-0000-000000000001';
select test.ok(true, 'produto que só aparece em pedido cancelado pode ser excluído');
select test.throws($$delete from public.products where id = '40000000-0000-0000-0000-000000000002'$$,
  'PRODUCT_IN_ORDERS', 'produto em pedido válido continua protegido');
reset role;

select test.ok((select product_id is null and product_name = 'Só em cancelado' and unit_price_cents = 500
                  from public.order_items i join public.orders o on o.id = i.order_id
                 where o.order_number = (select res->>'order_number' from e1)),
  'pedido cancelado mantém nome e preço do produto excluído');

\echo '>>> EXCLUSÃO DE PRODUTO: TODOS OS TESTES PASSARAM'
