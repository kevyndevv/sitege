-- =============================================================================
-- Site de encomendas — estrutura inicial do banco (Supabase / PostgreSQL)
-- =============================================================================
-- Como aplicar: Supabase → SQL Editor → cole este arquivo inteiro → Run.
--
-- A migração é NÃO destrutiva: ela não apaga nem altera tabelas existentes.
-- Se alguma tabela com o mesmo nome já existir, ela para logo no início com uma
-- mensagem explicando o conflito, e nada é aplicado (tudo roda numa transação).
--
-- Resumo das decisões (detalhes em docs/BANCO_DE_DADOS.md):
--   * Clientes anônimos NÃO acessam as tabelas de pedidos. Pedidos só entram
--     pela função create_order (SECURITY DEFINER), que valida tudo e calcula
--     preços e totais a partir do catálogo oficial.
--   * A consulta de pedido pelo cliente usa get_order_tracking(código, segredo).
--     O segredo é guardado apenas como hash SHA-256.
--   * A dona é identificada pela tabela admins (vinculada ao Supabase Auth).
--     Toda permissão administrativa passa por public.is_admin() nas políticas RLS.
--   * Valores em centavos (integer). Itens do pedido guardam nome e preço do
--     momento da compra, preservando o histórico.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Verificação de segurança: não sobrescrever nada que já exista
-- -----------------------------------------------------------------------------
do $$
declare
  conflitos text;
begin
  select string_agg(table_name, ', ')
    into conflitos
    from information_schema.tables
   where table_schema = 'public'
     and table_name in ('admins', 'categories', 'products', 'orders',
                        'order_items', 'order_status_history', 'business_settings');
  if conflitos is not null then
    raise exception 'Migração não aplicada: já existem as tabelas [%]. Se esta migração já foi aplicada antes, não é preciso rodá-la de novo. Caso contrário, revise as tabelas existentes antes de continuar.', conflitos;
  end if;
end $$;

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

-- Contas autorizadas a acessar o painel (a dona). Sem senhas aqui: o login é
-- feito pelo Supabase Auth; esta tabela apenas diz QUEM é administradora.
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index categories_name_unique on public.categories (lower(btrim(name)));

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 600),
  -- Preço em centavos. NULL = "preço a combinar" (não inventamos valores).
  price_cents integer check (price_cents is null or price_cents between 0 and 10000000),
  -- Unidade de venda opcional: "unidade", "cento", "kg", "fatia"...
  unit_label  text check (unit_label is null or char_length(btrim(unit_label)) between 1 and 30),
  image_path  text check (image_path is null or char_length(image_path) <= 300),
  category_id uuid references public.categories (id) on delete set null,
  -- active = disponível para pedidos agora; archived = fora do catálogo e da
  -- lista principal do painel, mas preservado para o histórico.
  active      boolean not null default true,
  archived    boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index products_category_id_idx on public.products (category_id);
create index products_catalog_idx on public.products (sort_order, name) where active and not archived;

create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  -- Código público aleatório (ex.: 7KQ4-M2XP). Não é sequencial nem previsível.
  order_number        text not null unique check (order_number ~ '^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$'),
  customer_name       text not null check (char_length(customer_name) between 2 and 80),
  customer_phone      text not null check (customer_phone ~ '^[0-9]{10,13}$'),
  status              text not null default 'pending'
                      check (status in ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  fulfillment_type    text not null check (fulfillment_type in ('delivery', 'pickup')),
  delivery_address    text check (delivery_address is null or char_length(delivery_address) between 5 and 300),
  requested_date      date,
  requested_time      time,
  notes               text check (notes is null or char_length(notes) <= 500),
  admin_notes         text check (admin_notes is null or char_length(admin_notes) <= 1000),
  -- Taxa de entrega aplicada. NULL = a combinar (taxa não configurada).
  delivery_fee_cents  integer check (delivery_fee_cents is null or delivery_fee_cents >= 0),
  -- Soma dos itens com preço + taxa (quando houver). Calculado no servidor.
  total_cents         integer not null check (total_cents >= 0),
  tracking_token_hash bytea not null,
  idempotency_key     uuid not null unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint orders_delivery_needs_address
    check (fulfillment_type <> 'delivery' or delivery_address is not null),
  constraint orders_pickup_without_address
    check (fulfillment_type <> 'pickup' or delivery_address is null)
);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_updated_at_idx on public.orders (updated_at desc); -- painel: detectar mudanças
create index orders_status_created_at_idx on public.orders (status, created_at desc);
create index orders_phone_created_at_idx on public.orders (customer_phone, created_at desc);

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  -- RESTRICT: um produto que já foi pedido não pode ser apagado (deve ser arquivado).
  product_id       uuid references public.products (id) on delete restrict,
  product_name     text not null,
  unit_label       text,
  unit_price_cents integer check (unit_price_cents is null or unit_price_cents >= 0),
  quantity         integer not null check (quantity between 1 and 999),
  subtotal_cents   integer,
  constraint order_items_subtotal_consistent check (
    (unit_price_cents is null and subtotal_cents is null)
    or subtotal_cents = unit_price_cents * quantity
  )
);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

create table public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- Configurações do negócio: uma única linha (id = true).
-- Tudo começa vazio: nada de nomes, telefones ou taxas inventados.
create table public.business_settings (
  id                 boolean primary key default true check (id),
  business_name      text check (business_name is null or char_length(business_name) <= 80),
  hero_title         text check (hero_title is null or char_length(hero_title) <= 120),
  hero_text          text check (hero_text is null or char_length(hero_text) <= 600),
  about_text         text check (about_text is null or char_length(about_text) <= 1200),
  logo_path          text check (logo_path is null or char_length(logo_path) <= 300),
  hero_image_path    text check (hero_image_path is null or char_length(hero_image_path) <= 300),
  instagram_handle   text check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  whatsapp_number    text check (whatsapp_number is null or whatsapp_number ~ '^[0-9]{10,13}$'),
  contact_email      text check (contact_email is null or char_length(contact_email) <= 120),
  city               text check (city is null or char_length(city) <= 120),
  opening_hours      text check (opening_hours is null or char_length(opening_hours) <= 300),
  accepting_orders   boolean not null default true,
  closed_message     text check (closed_message is null or char_length(closed_message) <= 300),
  offers_pickup      boolean not null default false,
  offers_delivery    boolean not null default false,
  pickup_info        text check (pickup_info is null or char_length(pickup_info) <= 400),
  delivery_info      text check (delivery_info is null or char_length(delivery_info) <= 400),
  delivery_fee_cents integer check (delivery_fee_cents is null or delivery_fee_cents between 0 and 1000000),
  min_lead_days      smallint check (min_lead_days is null or min_lead_days between 0 and 60),
  order_notice       text check (order_notice is null or char_length(order_notice) <= 400),
  updated_at         timestamptz not null default now()
);
insert into public.business_settings (id) values (true);

-- -----------------------------------------------------------------------------
-- 2. Funções auxiliares e gatilhos
-- -----------------------------------------------------------------------------

-- A pessoa logada é administradora? Usada em TODAS as políticas administrativas.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger business_settings_set_updated_at before update on public.business_settings
  for each row execute function public.set_updated_at();

-- Histórico auditável: toda criação e mudança de status é registrada
-- automaticamente, com quem fez a alteração (auth.uid()).
create function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, (select auth.uid()));
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, (select auth.uid()));
  end if;
  return null;
end;
$$;

create trigger orders_log_status
  after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- Gera texto aleatório com alfabeto sem caracteres ambíguos (sem 0/O, 1/I).
-- 32 símbolos → cada byte aleatório % 32 é uniforme (256 é múltiplo de 32).
create function public.random_code(p_length integer)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea := extensions.gen_random_bytes(p_length);
  result text := '';
begin
  for i in 0 .. p_length - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

-- Normaliza o segredo digitado pelo cliente (maiúsculas, sem traços/espaços).
create function public.normalize_code(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_value, ''), '[^0-9A-Za-z]', '', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- 3. Criação de pedidos (única porta de entrada para clientes anônimos)
-- -----------------------------------------------------------------------------
-- Erros são devolvidos como códigos curtos (ex.: ORDERS_CLOSED) que o site
-- traduz em mensagens amigáveis. Nenhum dado pessoal aparece nas mensagens.
create function public.create_order(
  p_idempotency_key  uuid,
  p_customer_name    text,
  p_customer_phone   text,
  p_fulfillment_type text,
  p_delivery_address text,
  p_requested_date   date,
  p_requested_time   time,
  p_notes            text,
  p_items            jsonb
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
    v_fee := s.delivery_fee_cents; -- NULL = a combinar
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
    delivery_address, requested_date, requested_time, notes,
    delivery_fee_cents, total_cents, tracking_token_hash, idempotency_key
  ) values (
    v_order_number, v_name, v_phone, 'pending', p_fulfillment_type,
    v_address, p_requested_date, p_requested_time, v_notes,
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

-- -----------------------------------------------------------------------------
-- 4. Consulta de pedido pelo cliente (código + segredo)
-- -----------------------------------------------------------------------------
-- Retorna NULL tanto para código inexistente quanto para segredo errado, para
-- não revelar quais códigos existem. Não devolve nome, telefone, endereço nem
-- observações — só o necessário para acompanhar a encomenda.
create function public.get_order_tracking(p_order_number text, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code  text := public.normalize_code(p_order_number);
  v_token text := public.normalize_code(p_token);
  o       public.orders%rowtype;
begin
  if char_length(v_code) <> 8 or char_length(v_token) <> 16 then
    return null;
  end if;
  v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);

  select * into o
    from public.orders
   where order_number = v_code
     and tracking_token_hash = extensions.digest(v_token, 'sha256');
  if not found then
    return null;
  end if;

  return jsonb_build_object(
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
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Produtos mais pedidos (página inicial)
-- -----------------------------------------------------------------------------
-- Critério documentado:
--   * Contam apenas pedidos que a dona já CONFIRMOU: confirmed, preparing,
--     ready e completed. Pedidos "pending" ficam de fora porque ainda não foram
--     aceitos (e qualquer pessoa anônima poderia inflar a lista com pedidos
--     falsos). Pedidos cancelados nunca contam.
--   * Soma das quantidades efetivamente pedidas de cada produto.
--   * Desempate: nº de pedidos distintos (desc) e depois nome (A→Z).
--   * Só aparecem produtos ativos e não arquivados.
--   * A seção só aparece com pelo menos 3 pedidos confirmados no total, para
--     não chamar de "mais pedido" algo com um único pedido.
--   * Não devolve números de vendas ao público, apenas a ordem.
create function public.get_popular_products(p_limit integer default 6)
returns table (
  id          uuid,
  name        text,
  description text,
  price_cents integer,
  unit_label  text,
  image_path  text,
  rank        integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_orders as (
    select o.id
      from public.orders o
     where o.status in ('confirmed', 'preparing', 'ready', 'completed')
  ),
  ranking as (
    select i.product_id,
           sum(i.quantity) as total_quantity,
           count(distinct i.order_id) as order_count
      from public.order_items i
      join eligible_orders e on e.id = i.order_id
     where i.product_id is not null
     group by i.product_id
  )
  select p.id, p.name, p.description, p.price_cents, p.unit_label, p.image_path,
         (row_number() over (order by r.total_quantity desc, r.order_count desc, p.name asc, p.id))::integer as rank
    from ranking r
    join public.products p on p.id = r.product_id and p.active and not p.archived
   where (select count(*) from eligible_orders) >= 3
   order by rank
   limit least(greatest(coalesce(p_limit, 6), 1), 12);
$$;

-- -----------------------------------------------------------------------------
-- 6. Estatísticas do painel (somente administradora)
-- -----------------------------------------------------------------------------
create function public.get_admin_stats(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  return jsonb_build_object(
    'by_status', coalesce((
      select jsonb_object_agg(status, total)
        from (select o.status, count(*) as total
                from public.orders o
               where o.created_at >= p_from and o.created_at < p_to
               group by o.status) t
    ), '{}'::jsonb),
    'open_by_status', coalesce((
      select jsonb_object_agg(status, total)
        from (select o.status, count(*) as total
                from public.orders o
               where o.status in ('pending', 'confirmed', 'preparing', 'ready')
               group by o.status) t
    ), '{}'::jsonb),
    'orders_in_period', (
      select count(*) from public.orders o
       where o.created_at >= p_from and o.created_at < p_to
    ),
    'revenue_cents', (
      select coalesce(sum(o.total_cents), 0) from public.orders o
       where o.created_at >= p_from and o.created_at < p_to and o.status <> 'cancelled'
    ),
    'top_products', coalesce((
      select jsonb_agg(t order by t.quantity desc, t.orders desc, t.name)
        from (select i.product_name as name,
                     sum(i.quantity)::integer as quantity,
                     count(distinct i.order_id)::integer as orders
                from public.order_items i
                join public.orders o on o.id = i.order_id
               where o.created_at >= p_from and o.created_at < p_to
                 and o.status <> 'cancelled'
               group by i.product_name
               order by sum(i.quantity) desc, count(distinct i.order_id) desc, i.product_name
               limit 8) t
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Permissões (GRANTs) — explícitas, sem depender dos padrões do projeto
-- -----------------------------------------------------------------------------
revoke all on public.admins, public.categories, public.products, public.orders,
              public.order_items, public.order_status_history, public.business_settings
  from anon, authenticated;

grant select on public.categories, public.products, public.business_settings to anon, authenticated;
grant select on public.admins to authenticated;
grant insert, update, delete on public.categories, public.products to authenticated;
grant select on public.orders, public.order_items, public.order_status_history to authenticated;
-- A dona só pode alterar estes campos de um pedido (nunca preços, totais ou segredo):
grant update (status, admin_notes, requested_date, requested_time) on public.orders to authenticated;
grant update (business_name, hero_title, hero_text, about_text, logo_path, hero_image_path,
              instagram_handle, whatsapp_number, contact_email, city, opening_hours,
              accepting_orders, closed_message, offers_pickup, offers_delivery, pickup_info,
              delivery_info, delivery_fee_cents, min_lead_days, order_notice)
  on public.business_settings to authenticated;

revoke all on function public.is_admin() from public;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.log_order_status() from public, anon, authenticated;
revoke all on function public.random_code(integer) from public, anon, authenticated;
revoke all on function public.normalize_code(text) from public, anon, authenticated;
revoke all on function public.create_order(uuid, text, text, text, text, date, time, text, jsonb) from public;
revoke all on function public.get_order_tracking(text, text) from public;
revoke all on function public.get_popular_products(integer) from public;
revoke all on function public.get_admin_stats(timestamptz, timestamptz) from public, anon;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, text, date, time, text, jsonb) to anon, authenticated;
grant execute on function public.get_order_tracking(text, text) to anon, authenticated;
grant execute on function public.get_popular_products(integer) to anon, authenticated;
grant execute on function public.get_admin_stats(timestamptz, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.admins               enable row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.business_settings    enable row level security;

-- admins: cada pessoa logada só enxerga a própria linha (para saber se é admin).
-- Inclusões/remoções só pelo SQL Editor (nenhuma política de escrita).
create policy "admins: ver a própria linha" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- categories
create policy "categories: leitura pública" on public.categories
  for select to anon, authenticated using (true);
create policy "categories: admin insere" on public.categories
  for insert to authenticated with check ((select public.is_admin()));
create policy "categories: admin altera" on public.categories
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "categories: admin remove" on public.categories
  for delete to authenticated using ((select public.is_admin()));

-- products: público vê só o que está disponível; admin vê e gerencia tudo
create policy "products: leitura pública dos disponíveis" on public.products
  for select to anon, authenticated using (active and not archived);
create policy "products: admin vê todos" on public.products
  for select to authenticated using ((select public.is_admin()));
create policy "products: admin insere" on public.products
  for insert to authenticated with check ((select public.is_admin()));
create policy "products: admin altera" on public.products
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products: admin remove" on public.products
  for delete to authenticated using ((select public.is_admin()));

-- orders / itens / histórico: SOMENTE a administradora. Clientes anônimos não
-- têm nenhuma política aqui (criam via create_order e consultam via
-- get_order_tracking).
create policy "orders: admin lê" on public.orders
  for select to authenticated using ((select public.is_admin()));
create policy "orders: admin altera" on public.orders
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "order_items: admin lê" on public.order_items
  for select to authenticated using ((select public.is_admin()));
create policy "order_status_history: admin lê" on public.order_status_history
  for select to authenticated using ((select public.is_admin()));

-- business_settings: leitura pública (só contém informações públicas do negócio)
create policy "business_settings: leitura pública" on public.business_settings
  for select to anon, authenticated using (true);
create policy "business_settings: admin altera" on public.business_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- 9. Armazenamento de imagens (Supabase Storage)
-- -----------------------------------------------------------------------------
-- Bucket público para LEITURA (fotos aparecem no site). Só a admin envia,
-- substitui ou apaga arquivos. Limite de 5 MB e apenas imagens.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('site-images', 'site-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  create policy "site-images: admin lê" on storage.objects
    for select to authenticated using (bucket_id = 'site-images' and (select public.is_admin()));
  create policy "site-images: admin envia" on storage.objects
    for insert to authenticated with check (bucket_id = 'site-images' and (select public.is_admin()));
  create policy "site-images: admin substitui" on storage.objects
    for update to authenticated using (bucket_id = 'site-images' and (select public.is_admin()))
    with check (bucket_id = 'site-images' and (select public.is_admin()));
  create policy "site-images: admin apaga" on storage.objects
    for delete to authenticated using (bucket_id = 'site-images' and (select public.is_admin()));
exception
  when insufficient_privilege then
    raise warning 'Não foi possível configurar o Storage por SQL neste projeto. Crie o bucket "site-images" (público) e as políticas pelo painel, conforme docs/BANCO_DE_DADOS.md.';
  when duplicate_object then
    raise notice 'Políticas do bucket site-images já existiam; mantidas como estão.';
end $$;

commit;
