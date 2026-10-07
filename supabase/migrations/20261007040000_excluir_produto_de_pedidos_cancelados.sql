-- =============================================================================
-- Permite excluir um produto que só aparece em pedidos CANCELADOS.
--
-- Antes, qualquer pedido (até cancelado) impedia a exclusão (ON DELETE RESTRICT).
-- Agora a ligação item → produto vira ON DELETE SET NULL: o item do pedido
-- continua guardando nome, unidade, preço e quantidade do momento da compra,
-- então o histórico não muda. Só a ligação com o cadastro do produto some.
--
-- A regra "não excluir produto que está em pedido válido" passa a ser aplicada
-- pelo painel (Server Action deleteProduct) e também aqui no banco, por gatilho.
-- Não apaga dados.
-- =============================================================================
begin;

alter table public.order_items drop constraint order_items_product_id_fkey;
alter table public.order_items
  add constraint order_items_product_id_fkey
  foreign key (product_id) references public.products (id) on delete set null;

-- Proteção no banco: produto presente em pedido NÃO cancelado não pode ser apagado.
create function public.prevent_delete_product_in_orders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.order_items i
      join public.orders o on o.id = i.order_id
     where i.product_id = old.id
       and o.status <> 'cancelled'
  ) then
    raise exception 'PRODUCT_IN_ORDERS';
  end if;
  return old;
end;
$$;

revoke all on function public.prevent_delete_product_in_orders() from public, anon, authenticated;

create trigger products_prevent_delete_in_orders
  before delete on public.products
  for each row execute function public.prevent_delete_product_in_orders();

commit;
