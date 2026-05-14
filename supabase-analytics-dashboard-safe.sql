-- Radios analytics dashboard setup.
-- Safe to run more than once. Adds passive storefront analytics events and admin-only read access.

create extension if not exists pgcrypto;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  session_id text,
  auth_user_id uuid,
  customer_id uuid,
  product_id uuid,
  order_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

alter table public.analytics_events add column if not exists event_name text;
alter table public.analytics_events add column if not exists session_id text;
alter table public.analytics_events add column if not exists auth_user_id uuid;
alter table public.analytics_events add column if not exists customer_id uuid;
alter table public.analytics_events add column if not exists product_id uuid;
alter table public.analytics_events add column if not exists order_id uuid;
alter table public.analytics_events add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.analytics_events add column if not exists created_at timestamp with time zone default now();

update public.analytics_events
set metadata = coalesce(metadata, '{}'::jsonb),
    created_at = coalesce(created_at, now())
where metadata is null or created_at is null;

create index if not exists analytics_events_name_date_idx
on public.analytics_events(event_name, created_at desc);

create index if not exists analytics_events_product_idx
on public.analytics_events(product_id);

create index if not exists analytics_events_session_idx
on public.analytics_events(session_id);

create index if not exists analytics_events_auth_user_idx
on public.analytics_events(auth_user_id);

create index if not exists analytics_events_order_idx
on public.analytics_events(order_id);

create or replace function public.analytics_admin_allowed()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed boolean := false;
begin
  if auth.role() = 'service_role' then
    return true;
  end if;

  if to_regclass('public.admin_users') is not null then
    execute
      'select exists (
        select 1
        from public.admin_users admin
        where admin.auth_user_id = $1
          and admin.is_active = true
          and admin.role in (''admin'', ''manager'', ''staff'')
      )'
    into allowed
    using auth.uid();
  end if;

  return coalesce(allowed, false);
end;
$$;

alter table public.analytics_events enable row level security;

drop policy if exists "Storefront can insert analytics events" on public.analytics_events;
create policy "Storefront can insert analytics events"
on public.analytics_events
for insert
with check (true);

drop policy if exists "Admins can read analytics events" on public.analytics_events;
create policy "Admins can read analytics events"
on public.analytics_events
for select
using (public.analytics_admin_allowed());

grant insert on public.analytics_events to anon, authenticated;
grant select on public.analytics_events to authenticated;

do $$
begin
  if to_regclass('public.orders') is not null then
    execute $view$
      create or replace view public.analytics_daily_revenue as
      select
        date_trunc('day', created_at)::date as sales_date,
        count(*) filter (
          where lower(coalesce(status, '')) not in ('cancelled', 'canceled', 'refunded', 'returned', 'failed')
        ) as orders_count,
        coalesce(sum(coalesce(total, 0)) filter (
          where lower(coalesce(status, '')) not in ('cancelled', 'canceled', 'refunded', 'returned', 'failed')
        ), 0) as revenue
      from public.orders
      group by date_trunc('day', created_at)::date
    $view$;
  end if;

  if to_regclass('public.order_items') is not null then
    execute $view$
      create or replace view public.analytics_top_products as
      select
        order_items.product_id,
        max(order_items.product_name) as product_name,
        coalesce(sum(order_items.quantity), 0) as quantity_sold,
        coalesce(sum(coalesce(order_items.total, order_items.price * order_items.quantity)), 0) as revenue
      from public.order_items
      group by order_items.product_id
    $view$;
  end if;

  if to_regclass('public.wishlist') is not null then
    execute $view$
      create or replace view public.analytics_wishlist_products as
      select
        wishlist.product_id,
        count(*) as wishlist_count,
        max(wishlist.created_at) as last_wishlisted_at
      from public.wishlist
      group by wishlist.product_id
    $view$;
  end if;

  execute $view$
    create or replace view public.analytics_conversion_funnel as
    select
      event_name,
      count(*) as events_count,
      count(distinct session_id) as sessions_count,
      min(created_at) as first_seen_at,
      max(created_at) as last_seen_at
    from public.analytics_events
    group by event_name
  $view$;

  if to_regclass('public.orders') is not null then
    execute $view$
      create or replace view public.analytics_customer_retention as
      select
        coalesce(auth_user_id::text, customer_email) as customer_key,
        min(created_at) as first_order_at,
        max(created_at) as latest_order_at,
        count(*) as order_count,
        coalesce(sum(total), 0) as lifetime_value
      from public.orders
      where coalesce(auth_user_id::text, customer_email) is not null
      group by coalesce(auth_user_id::text, customer_email)
    $view$;
  end if;
end $$;

notify pgrst, 'reload schema';
