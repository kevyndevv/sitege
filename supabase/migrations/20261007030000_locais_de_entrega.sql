-- =============================================================================
-- Locais de entrega com taxa própria (ex.: "Ingleses" R$ 10, "Fora dos
-- Ingleses (região)" R$ 15). A dona edita os locais no painel.
--
-- * Se houver locais ativos, o cliente escolhe um ao pedir entrega e a taxa
--   vem do local escolhido (sempre calculada no banco).
-- * Se não houver nenhum local ativo, vale a taxa única das configurações.
-- * O pedido guarda o NOME do local e a taxa do momento (histórico preservado
--   mesmo se o local for renomeado ou apagado depois).
-- Não apaga dados. A função create_order é substituída pela nova versão.
-- =============================================================================
begin;

create table public.delivery_zones (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  fee_cents  integer not null check (fee_cents between 0 and 1000000),
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index delivery_zones_name_unique on public.delivery_zones (lower(btrim(name)));

alter table public.orders
  add column delivery_zone_name text
  check (delivery_zone_name is null or char_length(delivery_zone_name) <= 60);

-- Locais iniciais informados pelo responsável (editáveis no painel).
insert into public.delivery_zones (name, fee_cents, sort_order) values
  ('Ingleses', 1000, 1),
  ('Fora dos Ingleses (região)', 1500, 2);

-- Permissões e RLS: público vê só locais ativos; só a admin altera.
revoke all on public.delivery_zones from anon, authenticated;
grant select on public.delivery_zones to anon, authenticated;
grant insert, update, delete on public.delivery_zones to authenticated;
alter table public.delivery_zones enable row level security;

create policy "delivery_zones: leitura pública dos ativos" on public.delivery_zones
  for select to anon, authenticated using (active);
create policy "delivery_zones: admin vê todos" on public.delivery_zones
  for select to authenticated using ((select public.is_admin()));
create policy "delivery_zones: admin insere" on public.delivery_zones
  for insert to authenticated with check ((select public.is_admin()));
create policy "delivery_zones: admin altera" on public.delivery_zones
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "delivery_zones: admin remove" on public.delivery_zones
  for delete to authenticated using ((select public.is_admin()));

-- Nova versão de create_order (com o local de entrega).
drop function public.create_order(uuid, text, text, text, text, date, time, text, jsonb);

create function public.create_order(
  p_idempotency_key  uuid,
  p_customer_name    text,
  p_customer_phone   text,
  p_fulfillment_type text,
  p_delivery_address text,
  p_requested_date   date,
  p_requested_time   time,
  p_notes            text,
  p_items            jsonb,
  p_delivery_zone_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s              public.business_settings%rowtype;
  v_name         text := btrim(regexp_replace(coalesce(p_customer_name, ''), '\s+', ' ', 'g'));
  v_phone        text := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  v_address      text := nullif(btrim(coalesce(p_delivery_address, '')), '');
  v_notes        text := nullif(btrim(coalesce(p_notes, '')), '');
  v_today        date := (now() at time zone 'America/Sao_Paulo')::date;
  v_existing     public.orders%rowtype;
  v_token        text;
  v_order_id     uuid;
  v_order_number text;
  v_items_total  integer;
  v_fee          integer;
  v_item_count   integer;
  v_valid_count  integer;
  v_has_invalid  boolean;
  v_zone_name    text;
begin
  if p_idempotency_key is null then
    raise exception 'INVALID_REQUEST';
  end if;

  -- Reenvio do mesmo formulário (clique duplo, rede instável): não cria outro
  -- pedido. Como só guardamos o hash do segredo, geramos um novo segredo para
  -- quem tem a chave de idempotência (só o navegador que enviou a conhece).
  -- Serializa envios com a mesma chave (evita corrida entre dois cliques).
  perform pg_advisory_xact_lock(hashtext('order_idem:' || p_idempotency_key::text));
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.created_at < now() - interval '2 hours' or v_existing.status = 'cancelled' then
      raise exception 'DUPLICATE_ORDER';
    end if;
    v_token := public.random_code(16);
    update public.orders
       set tracking_token_hash = extensions.digest(v_token, 'sha256')
     where id = v_existing.id;
    return jsonb_build_object(
      'order_number', v_existing.order_number,
      'tracking_token', v_token,
      'total_cents', v_existing.total_cents,
      'duplicate', true
    );
  end if;

  select * into s from public.business_settings where id;
  if not found or not s.accepting_orders then
    raise exception 'ORDERS_CLOSED';
  end if;

  -- Dados do cliente
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'INVALID_NAME';
  end if;
  if v_phone !~ '^[0-9]{10,13}$' then
    raise exception 'INVALID_PHONE';
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'INVALID_NOTES';
  end if;

  -- Modalidade: apenas as que a dona habilitou
  if p_fulfillment_type = 'delivery' then
    if not s.offers_delivery then raise exception 'FULFILLMENT_UNAVAILABLE'; end if;
    if v_address is null or char_length(v_address) < 5 or char_length(v_address) > 300 then
      raise exception 'INVALID_ADDRESS';
    end if;
    -- Taxa por local de entrega (quando a dona cadastrou locais); senão, a
    -- taxa única das configurações (NULL = a combinar). Nunca vem do navegador.
    if exists (select 1 from public.delivery_zones z where z.active) then
      select z.name, z.fee_cents into v_zone_name, v_fee
        from public.delivery_zones z
       where z.id = p_delivery_zone_id and z.active;
      if not found then
        raise exception 'INVALID_ZONE';
      end if;
    else
      v_fee := s.delivery_fee_cents;
    end if;
  elsif p_fulfillment_type = 'pickup' then
    if not s.offers_pickup then raise exception 'FULFILLMENT_UNAVAILABLE'; end if;
    v_address := null; -- endereço não é necessário para retirada
    v_fee := 0;
  else
    raise exception 'FULFILLMENT_UNAVAILABLE';
  end if;

  -- Data desejada: obrigatória, respeitando a antecedência mínima configurada
  if p_requested_date is null then
    raise exception 'INVALID_DATE';
  end if;
  if p_requested_date < v_today + coalesce(s.min_lead_days, 0)
     or p_requested_date > v_today + 180 then
    raise exception 'INVALID_DATE';
  end if;

  -- Limites por cliente (identificado pelo telefone normalizado):
  --   * até 2 pedidos por dia (dia corrente no horário de Brasília);
  --   * até 5 pedidos nos últimos 7 dias.
  -- Pedidos cancelados/recusados NÃO contam: se a dona não aceitar o pedido,
  -- o cliente recupera o uso. Pedidos aguardando confirmação contam.
  -- O lock serializa pedidos simultâneos do mesmo telefone.
  perform pg_advisory_xact_lock(hashtext('create_order:' || v_phone));
  if (select count(*) from public.orders
       where customer_phone = v_phone
         and status <> 'cancelled'
         and created_at >= (v_today::timestamp at time zone 'America/Sao_Paulo')) >= 2 then
    raise exception 'DAILY_LIMIT';
  end if;
  if (select count(*) from public.orders
       where customer_phone = v_phone
         and status <> 'cancelled'
         and created_at >= now() - interval '7 days') >= 5 then
    raise exception 'WEEKLY_LIMIT';
  end if;
  -- Proteção geral contra robôs/inundação (independe do telefone).
  if (select count(*) from public.orders where created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'RATE_LIMITED';
  end if;

  -- Itens: estrutura, quantidades e produtos disponíveis
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ITEMS';
  end if;
  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 40 then
    raise exception 'INVALID_ITEMS';
  end if;

  -- Cada item precisa ser {"product_id": uuid, "quantity": inteiro 1..999},
  -- sem produtos repetidos. Qualquer coisa fora disso é recusada.
  begin
    select count(distinct x.product_id),
           coalesce(bool_or(x.product_id is null or x.quantity is null
                            or x.quantity < 1 or x.quantity > 999), true)
      into v_valid_count, v_has_invalid
      from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer);
  exception when others then
    raise exception 'INVALID_ITEMS';
  end;
  if v_has_invalid or v_valid_count <> v_item_count then
    raise exception 'INVALID_ITEMS';
  end if;

  -- Preços SEMPRE vêm do catálogo oficial, nunca do navegador.
  select count(*),
         coalesce(sum(p.price_cents * x.quantity) filter (where p.price_cents is not null), 0)
    into v_valid_count, v_items_total
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    join public.products p on p.id = x.product_id and p.active and not p.archived;

  if v_valid_count <> v_item_count then
    raise exception 'PRODUCT_UNAVAILABLE';
  end if;

  -- Código público único
  for attempt in 1 .. 10 loop
    v_order_number := public.random_code(4) || '-' || public.random_code(4);
    exit when not exists (select 1 from public.orders where order_number = v_order_number);
    if attempt = 10 then raise exception 'TRY_AGAIN'; end if;
  end loop;

  v_token := public.random_code(16);

  insert into public.orders (
    order_number, customer_name, customer_phone, status, fulfillment_type,
    delivery_address, delivery_zone_name, requested_date, requested_time, notes,
    delivery_fee_cents, total_cents, tracking_token_hash, idempotency_key
  ) values (
    v_order_number, v_name, v_phone, 'pending', p_fulfillment_type,
    v_address, v_zone_name, p_requested_date, p_requested_time, v_notes,
    v_fee, v_items_total + coalesce(v_fee, 0),
    extensions.digest(v_token, 'sha256'), p_idempotency_key
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, unit_label, unit_price_cents, quantity, subtotal_cents
  )
  select v_order_id, p.id, p.name, p.unit_label, p.price_cents, x.quantity, p.price_cents * x.quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    join public.products p on p.id = x.product_id
   order by p.sort_order, p.name;

  return jsonb_build_object(
    'order_number', v_order_number,
    'tracking_token', v_token,
    'total_cents', v_items_total + coalesce(v_fee, 0),
    'duplicate', false
  );
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, text, date, time, text, jsonb, uuid) from public;
grant execute on function public.create_order(uuid, text, text, text, text, date, time, text, jsonb, uuid) to anon, authenticated;

commit;
