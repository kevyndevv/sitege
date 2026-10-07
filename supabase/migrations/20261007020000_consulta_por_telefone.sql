-- =============================================================================
-- Consulta de pedidos pelo TELEFONE do cliente (decisão da dona do projeto).
--
-- Antes: o cliente precisava do código do pedido + chave secreta.
-- Agora: basta o telefone usado no pedido.
--
-- Risco aceito conscientemente: quem souber o telefone de alguém consegue ver
-- os pedidos dessa pessoa. Para limitar o que fica exposto, a função devolve
-- SOMENTE: número do pedido, datas, situação, itens e valores. Nunca nome,
-- telefone, endereço ou observações. E só pedidos dos últimos 60 dias (máx. 10).
-- O site ainda limita o número de consultas por IP.
-- =============================================================================
begin;

create or replace function public.get_orders_by_phone(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_alt   text;
begin
  if v_phone !~ '^[0-9]{10,13}$' then
    return '[]'::jsonb;
  end if;

  -- Aceita o número com ou sem o código do país (55).
  v_alt := case
             when v_phone like '55%' and char_length(v_phone) >= 12 then substr(v_phone, 3)
             else '55' || v_phone
           end;

  return coalesce((
    select jsonb_agg(item order by created_at desc)
      from (
        select o.created_at,
               jsonb_build_object(
                 'order_number', o.order_number,
                 'created_at', o.created_at,
                 'status', o.status,
                 'fulfillment_type', o.fulfillment_type,
                 'requested_date', o.requested_date,
                 'requested_time', o.requested_time,
                 'delivery_fee_cents', o.delivery_fee_cents,
                 'total_cents', o.total_cents,
                 'items', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'product_name', i.product_name,
                            'unit_label', i.unit_label,
                            'quantity', i.quantity,
                            'unit_price_cents', i.unit_price_cents,
                            'subtotal_cents', i.subtotal_cents
                          ) order by i.product_name)
                     from public.order_items i where i.order_id = o.id
                 ), '[]'::jsonb),
                 'history', coalesce((
                   select jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.created_at)
                                    order by h.created_at)
                     from public.order_status_history h where h.order_id = o.id
                 ), '[]'::jsonb)
               ) as item
          from public.orders o
         where o.customer_phone in (v_phone, v_alt)
           and o.created_at > now() - interval '60 days'
         order by o.created_at desc
         limit 10
      ) recent
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_orders_by_phone(text) from public;
grant execute on function public.get_orders_by_phone(text) to anon, authenticated;

-- A consulta por código + chave deixou de ser usada pelo site: tira da API
-- para não deixar uma porta aberta sem necessidade (a função continua no banco).
revoke execute on function public.get_order_tracking(text, text) from anon, authenticated;

commit;
