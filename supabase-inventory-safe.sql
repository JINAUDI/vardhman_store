-- Production inventory management for Vardhman Store.
-- Run this after supabase-orders.sql and supabase-auth-safe.sql.

create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text,
  name text,
  sku text,
  stock integer default 0,
  visible boolean default true,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text,
  status text default 'pending',
  created_at timestamp with time zone default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid,
  product_name text,
  quantity integer,
  price numeric,
  total numeric,
  created_at timestamp with time zone default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text default 'inventory',
  title text not null,
  message text,
  order_id uuid references public.orders(id) on delete cascade,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  email text unique not null,
  role text default 'admin',
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

alter table public.products add column if not exists stock integer default 0;
alter table public.products add column if not exists reserved_stock integer default 0;
alter table public.products add column if not exists available_stock integer generated always as (greatest(coalesce(stock, 0) - coalesce(reserved_stock, 0), 0)) stored;
alter table public.products add column if not exists low_stock_threshold integer default 5;
alter table public.products add column if not exists track_inventory boolean default true;
alter table public.products add column if not exists allow_backorder boolean default false;
alter table public.products add column if not exists inventory_status text default 'in_stock';
alter table public.products add column if not exists updated_at timestamp with time zone default now();

alter table public.orders add column if not exists stock_deducted_at timestamp with time zone;
alter table public.orders add column if not exists stock_restored_at timestamp with time zone;
alter table public.orders add column if not exists inventory_note text;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists updated_at timestamp with time zone default now();

alter table public.order_items add column if not exists product_id uuid;
alter table public.order_items add column if not exists quantity integer default 1;
alter table public.order_items add column if not exists product_name text;

alter table public.notifications add column if not exists type text default 'inventory';
alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists is_read boolean default false;

create table if not exists public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  change_type text not null,
  quantity_change integer not null,
  stock_before integer,
  stock_after integer,
  note text,
  created_by text default 'system',
  created_at timestamp with time zone default now()
);

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  session_id text,
  auth_user_id uuid,
  quantity integer not null default 1,
  status text default 'active',
  expires_at timestamp with time zone default (now() + interval '15 minutes'),
  created_at timestamp with time zone default now()
);

alter table public.inventory_logs enable row level security;
alter table public.stock_reservations enable row level security;

create index if not exists inventory_logs_product_id_created_at_idx on public.inventory_logs (product_id, created_at desc);
create index if not exists inventory_logs_order_id_idx on public.inventory_logs (order_id);
create index if not exists stock_reservations_active_idx on public.stock_reservations (product_id, status, expires_at);
create index if not exists stock_reservations_session_idx on public.stock_reservations (session_id, status);
create index if not exists products_inventory_status_idx on public.products (inventory_status);

create or replace function public.is_inventory_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'service_role'
    or exists (
      select 1
      from public.admin_users admin
      where admin.auth_user_id = auth.uid()
        and admin.is_active = true
        and admin.role in ('admin', 'manager')
    );
$$;

create or replace function public.apply_product_inventory_status()
returns trigger
language plpgsql
as $$
declare
  next_available integer;
begin
  new.reserved_stock := greatest(coalesce(new.reserved_stock, 0), 0);
  new.stock := coalesce(new.stock, 0);
  new.low_stock_threshold := greatest(coalesce(new.low_stock_threshold, 5), 0);
  new.track_inventory := coalesce(new.track_inventory, true);
  new.allow_backorder := coalesce(new.allow_backorder, false);

  if new.allow_backorder = false then
    new.stock := greatest(new.stock, 0);
  end if;

  next_available := greatest(new.stock - new.reserved_stock, 0);

  if new.track_inventory = false then
    new.inventory_status := 'not_tracked';
  elsif next_available <= 0 and new.allow_backorder = false then
    new.inventory_status := 'out_of_stock';
  elsif next_available <= new.low_stock_threshold and next_available > 0 then
    new.inventory_status := 'low_stock';
  else
    new.inventory_status := 'in_stock';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_inventory_status_trigger on public.products;
create trigger products_inventory_status_trigger
before insert or update of stock, reserved_stock, low_stock_threshold, track_inventory, allow_backorder
on public.products
for each row
execute function public.apply_product_inventory_status();

create or replace function public.notify_inventory_status(p_product_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row record;
  notification_title text;
  notification_message text;
begin
  select
    id,
    coalesce(nullif(title, ''), nullif(name, ''), nullif(sku, ''), 'Product') as product_name,
    sku,
    stock,
    reserved_stock,
    available_stock,
    low_stock_threshold,
    inventory_status
  into product_row
  from public.products
  where id = p_product_id;

  if not found or product_row.inventory_status not in ('low_stock', 'out_of_stock') then
    return;
  end if;

  if exists (
    select 1
    from public.notifications
    where type = 'inventory'
      and message like '%' || product_row.id::text || '%'
      and message like '%' || product_row.inventory_status || '%'
      and created_at > now() - interval '2 hours'
  ) then
    return;
  end if;

  notification_title := case
    when product_row.inventory_status = 'out_of_stock' then 'Out of Stock Alert'
    else 'Low Stock Alert'
  end;

  notification_message := product_row.product_name ||
    coalesce(' (' || nullif(product_row.sku, '') || ')', '') ||
    ' is ' || replace(product_row.inventory_status, '_', ' ') ||
    '. Available: ' || product_row.available_stock ||
    ', threshold: ' || product_row.low_stock_threshold ||
    '. Product ID: ' || product_row.id ||
    '. Status: ' || product_row.inventory_status ||
    coalesce('. ' || nullif(p_note, ''), '');

  insert into public.notifications (type, title, message, is_read)
  values ('inventory', notification_title, notification_message, false);
end;
$$;

create or replace function public.release_expired_stock_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation record;
  released_count integer := 0;
begin
  for reservation in
    update public.stock_reservations
    set status = 'expired'
    where status = 'active'
      and expires_at <= now()
    returning *
  loop
    update public.products
    set reserved_stock = greatest(coalesce(reserved_stock, 0) - reservation.quantity, 0)
    where id = reservation.product_id;

    insert into public.inventory_logs (product_id, order_id, change_type, quantity_change, note, created_by)
    values (reservation.product_id, reservation.order_id, 'reservation_expired', 0, 'Expired checkout reservation released', 'system');

    released_count := released_count + 1;
  end loop;

  return released_count;
end;
$$;

create or replace function public.release_stock_reservations(p_session_id text default null, p_order_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation record;
  released_count integer := 0;
begin
  for reservation in
    update public.stock_reservations
    set status = 'released'
    where status = 'active'
      and (p_session_id is null or session_id = p_session_id)
      and (p_order_id is null or order_id = p_order_id)
    returning *
  loop
    update public.products
    set reserved_stock = greatest(coalesce(reserved_stock, 0) - reservation.quantity, 0)
    where id = reservation.product_id;

    insert into public.inventory_logs (product_id, order_id, change_type, quantity_change, note, created_by)
    values (reservation.product_id, reservation.order_id, 'reservation_released', 0, 'Checkout reservation released', 'system');

    released_count := released_count + 1;
  end loop;

  return released_count;
end;
$$;

create or replace function public.validate_cart_stock(p_items jsonb)
returns table (
  product_id uuid,
  product_name text,
  requested_quantity integer,
  stock integer,
  reserved_stock integer,
  available_stock integer,
  low_stock_threshold integer,
  track_inventory boolean,
  allow_backorder boolean,
  inventory_status text,
  ok boolean,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.release_expired_stock_reservations();

  return query
  with cart_items as (
    select
      (item ->> 'product_id')::uuid as product_id,
      greatest(coalesce((item ->> 'quantity')::integer, 1), 1) as requested_quantity
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
    where item ? 'product_id'
      and (item ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
  select
    product.id,
    coalesce(nullif(product.title, ''), nullif(product.name, ''), nullif(product.sku, ''), 'Product') as product_name,
    cart.requested_quantity,
    coalesce(product.stock, 0) as stock,
    coalesce(product.reserved_stock, 0) as reserved_stock,
    coalesce(product.available_stock, greatest(coalesce(product.stock, 0) - coalesce(product.reserved_stock, 0), 0)) as available_stock,
    coalesce(product.low_stock_threshold, 5) as low_stock_threshold,
    coalesce(product.track_inventory, true) as track_inventory,
    coalesce(product.allow_backorder, false) as allow_backorder,
    coalesce(product.inventory_status, 'in_stock') as inventory_status,
    (
      coalesce(product.track_inventory, true) = false
      or coalesce(product.allow_backorder, false) = true
      or cart.requested_quantity <= coalesce(product.available_stock, greatest(coalesce(product.stock, 0) - coalesce(product.reserved_stock, 0), 0))
    ) as ok,
    case
      when product.id is null then 'Product is unavailable'
      when coalesce(product.track_inventory, true) = false then ''
      when coalesce(product.allow_backorder, false) = true then ''
      when coalesce(product.available_stock, greatest(coalesce(product.stock, 0) - coalesce(product.reserved_stock, 0), 0)) <= 0 then coalesce(nullif(product.title, ''), nullif(product.name, ''), 'This item') || ' is out of stock'
      when cart.requested_quantity > coalesce(product.available_stock, greatest(coalesce(product.stock, 0) - coalesce(product.reserved_stock, 0), 0)) then 'Only ' || coalesce(product.available_stock, greatest(coalesce(product.stock, 0) - coalesce(product.reserved_stock, 0), 0)) || ' left in stock for ' || coalesce(nullif(product.title, ''), nullif(product.name, ''), 'this item')
      else ''
    end as message
  from cart_items cart
  left join public.products product on product.id = cart.product_id;
end;
$$;

create or replace function public.reserve_cart_stock(p_items jsonb, p_session_id text, p_auth_user_id uuid default null)
returns setof public.stock_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  product_row record;
begin
  if nullif(p_session_id, '') is null then
    raise exception 'Checkout session is required';
  end if;

  perform public.release_expired_stock_reservations();
  perform public.release_stock_reservations(p_session_id, null);

  for item in select * from public.validate_cart_stock(p_items) loop
    if not item.ok then
      raise exception '%', item.message;
    end if;

    if item.track_inventory and not item.allow_backorder then
      update public.products
      set reserved_stock = coalesce(reserved_stock, 0) + item.requested_quantity
      where id = item.product_id
        and greatest(coalesce(stock, 0) - coalesce(reserved_stock, 0), 0) >= item.requested_quantity
      returning * into product_row;

      if not found then
        raise exception 'Only % left in stock for %', item.available_stock, item.product_name;
      end if;

      insert into public.stock_reservations (product_id, session_id, auth_user_id, quantity, status)
      values (item.product_id, p_session_id, p_auth_user_id, item.requested_quantity, 'active');

      perform public.notify_inventory_status(item.product_id, 'Stock reserved during checkout');
    end if;
  end loop;

  return query
  select *
  from public.stock_reservations
  where session_id = p_session_id
    and status = 'active'
  order by created_at desc;
end;
$$;

create or replace function public.complete_order_inventory(p_order_id uuid, p_items jsonb, p_session_id text default null, p_auth_user_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  product_row record;
  reserved_quantity integer;
  next_stock integer;
begin
  if p_order_id is null then
    raise exception 'Order ID is required for stock deduction';
  end if;

  if exists (select 1 from public.orders where id = p_order_id and stock_deducted_at is not null) then
    return true;
  end if;

  perform public.release_expired_stock_reservations();

  for item in
    select
      (cart_item ->> 'product_id')::uuid as product_id,
      greatest(coalesce((cart_item ->> 'quantity')::integer, 1), 1) as requested_quantity
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as cart_item
    where cart_item ? 'product_id'
      and (cart_item ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  loop
    select * into product_row
    from public.products
    where id = item.product_id
    for update;

    if not found then
      raise exception 'Product is unavailable';
    end if;

    if coalesce(product_row.track_inventory, true) then
      select coalesce(sum(quantity), 0)
      into reserved_quantity
      from public.stock_reservations
      where status = 'active'
        and product_id = item.product_id
        and (p_session_id is null or session_id = p_session_id);

      if coalesce(product_row.allow_backorder, false) = false and reserved_quantity < item.requested_quantity then
        if greatest(coalesce(product_row.stock, 0) - coalesce(product_row.reserved_stock, 0), 0) < item.requested_quantity then
          raise exception 'Only % left in stock for %',
            greatest(coalesce(product_row.stock, 0) - coalesce(product_row.reserved_stock, 0), 0),
            coalesce(nullif(product_row.title, ''), nullif(product_row.name, ''), nullif(product_row.sku, ''), 'this item');
        end if;
      end if;

      next_stock := coalesce(product_row.stock, 0) - item.requested_quantity;

      update public.products
      set
        stock = case
          when coalesce(product_row.allow_backorder, false) then next_stock
          else greatest(next_stock, 0)
        end,
        reserved_stock = greatest(coalesce(reserved_stock, 0) - least(reserved_quantity, item.requested_quantity), 0)
      where id = item.product_id
      returning * into product_row;

      update public.stock_reservations
      set status = 'completed',
          order_id = p_order_id
      where status = 'active'
        and product_id = item.product_id
        and (p_session_id is null or session_id = p_session_id);

      insert into public.inventory_logs (product_id, order_id, change_type, quantity_change, stock_before, stock_after, note, created_by)
      values (item.product_id, p_order_id, 'order_deduction', -item.requested_quantity, product_row.stock + item.requested_quantity, product_row.stock, 'Stock deducted for order', 'storefront');

      perform public.notify_inventory_status(item.product_id, 'Stock deducted for order');
    end if;
  end loop;

  update public.orders
  set stock_deducted_at = coalesce(stock_deducted_at, now()),
      updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;

create or replace function public.restore_order_inventory(p_order_id uuid, p_note text default null, p_created_by text default 'dashboard')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row record;
  item record;
  product_row record;
  before_stock integer;
begin
  if public.is_inventory_admin() = false then
    raise exception 'Not authorized to restore inventory';
  end if;

  select * into order_row
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if order_row.stock_restored_at is not null then
    return true;
  end if;

  for item in
    select product_id, product_name, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = p_order_id
      and product_id is not null
    group by product_id, product_name
  loop
    select * into product_row
    from public.products
    where id = item.product_id
    for update;

    if found and coalesce(product_row.track_inventory, true) then
      before_stock := coalesce(product_row.stock, 0);

      update public.products
      set stock = before_stock + greatest(item.quantity, 0)
      where id = item.product_id
      returning * into product_row;

      insert into public.inventory_logs (product_id, order_id, change_type, quantity_change, stock_before, stock_after, note, created_by)
      values (item.product_id, p_order_id, 'restore_cancelled_order', item.quantity, before_stock, product_row.stock, coalesce(p_note, 'Stock restored after cancellation/refund'), p_created_by);

      perform public.notify_inventory_status(item.product_id, 'Stock restored');
    end if;
  end loop;

  update public.orders
  set stock_restored_at = now(),
      inventory_note = coalesce(p_note, inventory_note),
      updated_at = now()
  where id = p_order_id;

  insert into public.notifications (type, title, message, order_id, is_read)
  values ('inventory', 'Stock Restored', 'Stock restored for order ' || coalesce(order_row.order_number, p_order_id::text), p_order_id, false);

  return true;
end;
$$;

create or replace function public.adjust_product_stock(p_product_id uuid, p_quantity_change integer, p_note text default null, p_created_by text default 'dashboard')
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.products;
  before_stock integer;
begin
  if public.is_inventory_admin() = false then
    raise exception 'Not authorized to adjust inventory';
  end if;

  select * into product_row
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  before_stock := coalesce(product_row.stock, 0);

  update public.products
  set stock = case
    when coalesce(product_row.allow_backorder, false) then before_stock + coalesce(p_quantity_change, 0)
    else greatest(before_stock + coalesce(p_quantity_change, 0), 0)
  end
  where id = p_product_id
  returning * into product_row;

  insert into public.inventory_logs (product_id, change_type, quantity_change, stock_before, stock_after, note, created_by)
  values (p_product_id, 'manual_adjustment', coalesce(p_quantity_change, 0), before_stock, product_row.stock, p_note, p_created_by);

  perform public.notify_inventory_status(p_product_id, p_note);

  return product_row;
end;
$$;

drop policy if exists "Dashboard can manage inventory logs" on public.inventory_logs;
create policy "Dashboard can manage inventory logs"
on public.inventory_logs
for all
using (public.is_inventory_admin())
with check (public.is_inventory_admin());

drop policy if exists "Dashboard can read inventory logs" on public.inventory_logs;
create policy "Dashboard can read inventory logs"
on public.inventory_logs
for select
using (public.is_inventory_admin());

drop policy if exists "Public can create stock reservations" on public.stock_reservations;
create policy "Public can create stock reservations"
on public.stock_reservations
for insert
with check (true);

drop policy if exists "Public can read own stock reservations" on public.stock_reservations;
create policy "Public can read own stock reservations"
on public.stock_reservations
for select
using (
  auth.uid() = auth_user_id
  or session_id is not null
  or public.is_inventory_admin()
);

drop policy if exists "Dashboard can manage stock reservations" on public.stock_reservations;
create policy "Dashboard can manage stock reservations"
on public.stock_reservations
for all
using (public.is_inventory_admin())
with check (public.is_inventory_admin());

grant execute on function public.validate_cart_stock(jsonb) to anon, authenticated;
grant execute on function public.reserve_cart_stock(jsonb, text, uuid) to anon, authenticated;
grant execute on function public.release_expired_stock_reservations() to anon, authenticated;
grant execute on function public.release_stock_reservations(text, uuid) to anon, authenticated;
grant execute on function public.complete_order_inventory(uuid, jsonb, text, uuid) to anon, authenticated;
grant execute on function public.restore_order_inventory(uuid, text, text) to authenticated;
grant execute on function public.adjust_product_stock(uuid, integer, text, text) to authenticated;
grant select on public.inventory_logs, public.stock_reservations to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.inventory_logs;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.stock_reservations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
