-- =========================
-- RADIOS FINAL SAFE SCHEMA
-- Generated from project Supabase scripts with corrected homepage_banners performance index.
-- Safe to run more than once. Does not drop tables or delete existing data.
-- =========================


-- ===== BEGIN supabase-orders.sql =====

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text,
  description text,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text,
  name text,
  slug text unique,
  sku text unique,
  description text,
  price numeric(12,2) not null default 0,
  compare_at_price numeric(12,2),
  image text,
  image_url text,
  images text[] default '{}'::text[],
  category text,
  category_slug text,
  stock integer default 0,
  low_stock_threshold integer default 10,
  visible boolean default true,
  is_active boolean default true,
  status text default 'active',
  featured boolean default false,
  tags text[] default '{}'::text[],
  meta_title text,
  meta_description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  image_url text,
  collection_type text not null default 'manual',
  is_active boolean default true,
  sales_channels text[] default array['Online Store']::text[],
  theme_template text default 'default-collection',
  sort_order integer default 0,
  sort_type text default 'manual',
  conditions_match text default 'all',
  conditions jsonb default '[]'::jsonb,
  product_ids text[] default '{}'::text[],
  tags text[] default '{}'::text[],
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.homepage_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  button_text text default 'Shop Now',
  button_link text,
  image_url text not null,
  category_id uuid references public.categories(id) on delete set null,
  section_key text default 'hero',
  banner_type text default 'hero',
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  title text,
  code text unique,
  method text not null default 'code',
  type text not null default 'percentage',
  value_type text not null default 'percentage',
  discount_category text not null default 'product_discount',
  value numeric(12,2) not null default 0,
  target_scope text default 'all_products',
  target_product_ids text[] default '{}'::text[],
  target_collection_ids text[] default '{}'::text[],
  target_category_slugs text[] default '{}'::text[],
  min_order_amount numeric(12,2) default 0,
  min_quantity integer default 0,
  requirement_type text default 'none',
  max_discount numeric(12,2),
  usage_limit integer default 0,
  used_count integer default 0,
  once_per_customer boolean default false,
  starts_at timestamp with time zone default now(),
  ends_at timestamp with time zone,
  status text not null default 'active',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text,
  email text unique,
  phone text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  email text unique not null,
  role text default 'admin',
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  tracking_id text unique,
  tracking_status text default 'Order Placed',
  estimated_delivery_date date,
  tracking_updated_at timestamp with time zone default now(),
  customer_name text,
  customer_email text,
  customer_phone text,
  delivery_address text,
  city text,
  state text,
  pincode text,
  payment_method text,
  delivery_method text,
  subtotal numeric,
  discount numeric default 0,
  delivery_charge numeric default 0,
  total numeric,
  status text default 'pending',
  notes text,
  created_at timestamp with time zone default now()
);

alter table public.orders add column if not exists tracking_id text unique;
alter table public.orders add column if not exists tracking_status text default 'Order Placed';
alter table public.orders add column if not exists estimated_delivery_date date;
alter table public.orders add column if not exists tracking_updated_at timestamp with time zone default now();
alter table public.orders add column if not exists auth_user_id uuid;
alter table public.orders add column if not exists customer_id uuid;
alter table public.orders add column if not exists country text default 'India';
alter table public.orders add column if not exists payment_status text default 'unpaid';
alter table public.orders add column if not exists shipping_status text default 'not_shipped';
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists courier text;
alter table public.orders add column if not exists estimated_delivery timestamp with time zone;
alter table public.orders add column if not exists updated_at timestamp with time zone default now();

alter table public.products add column if not exists title text;
alter table public.products add column if not exists name text;
alter table public.products add column if not exists slug text;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists price numeric(12,2) default 0;
alter table public.products add column if not exists compare_at_price numeric(12,2);
alter table public.products add column if not exists image text;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists images text[] default '{}'::text[];
alter table public.products add column if not exists category text;
alter table public.products add column if not exists category_slug text;
alter table public.products add column if not exists stock integer default 0;
alter table public.products add column if not exists low_stock_threshold integer default 10;
alter table public.products add column if not exists visible boolean default true;
alter table public.products add column if not exists is_active boolean default true;
alter table public.products add column if not exists status text default 'active';
alter table public.products add column if not exists featured boolean default false;
alter table public.products add column if not exists tags text[] default '{}'::text[];
alter table public.products add column if not exists updated_at timestamp with time zone default now();

alter table public.customers add column if not exists auth_user_id uuid unique;
alter table public.customers add column if not exists full_name text;
alter table public.customers add column if not exists email text;
alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists is_active boolean default true;

alter table public.admin_users add column if not exists auth_user_id uuid unique;
alter table public.admin_users add column if not exists email text unique;
alter table public.admin_users add column if not exists role text default 'admin';
alter table public.admin_users add column if not exists is_active boolean default true;

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
  type text default 'order',
  title text not null,
  message text,
  order_id uuid references public.orders(id) on delete cascade,
  tracking_id text,
  customer_name text,
  customer_phone text,
  customer_email text,
  total numeric,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text,
  auth_user_id uuid,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_email text,
  rating integer check (rating between 1 and 5),
  title text,
  body text,
  is_approved boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  customer_id uuid references public.customers(id) on delete cascade,
  product_id text not null,
  created_at timestamp with time zone default now(),
  unique (auth_user_id, product_id)
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_type text,
  product_id text,
  order_id uuid references public.orders(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  auth_user_id uuid,
  session_id text,
  path text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.collections enable row level security;
alter table public.homepage_banners enable row level security;
alter table public.discounts enable row level security;
alter table public.customers enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.wishlist enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists "Allow public select active categories" on public.categories;
create policy "Allow public select active categories"
on public.categories
for select
using (is_active = true);

drop policy if exists "Allow public select visible products" on public.products;
create policy "Allow public select visible products"
on public.products
for select
using (coalesce(visible, true) = true and coalesce(is_active, true) = true);

drop policy if exists "Allow public select active collections" on public.collections;
create policy "Allow public select active collections"
on public.collections
for select
using (is_active = true);

drop policy if exists "Allow public select active homepage banners" on public.homepage_banners;
create policy "Allow public select active homepage banners"
on public.homepage_banners
for select
using (is_active = true);

drop policy if exists "Allow public select active discounts" on public.discounts;
create policy "Allow public select active discounts"
on public.discounts
for select
using (status = 'active');

drop policy if exists "Customers manage own profile" on public.customers;
create policy "Customers manage own profile"
on public.customers
for all
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists "Allow service role manage admin users" on public.admin_users;
create policy "Allow service role manage admin users"
on public.admin_users
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage customers" on public.customers;
create policy "Allow service role manage customers"
on public.customers
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage orders" on public.orders;
create policy "Allow service role manage orders"
on public.orders
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage order items" on public.order_items;
create policy "Allow service role manage order items"
on public.order_items
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Allow public create orders" on public.orders;
create policy "Allow public create orders" on public.orders for insert with check (true);

drop policy if exists "Allow public create order items" on public.order_items;
create policy "Allow public create order items" on public.order_items for insert with check (true);

drop policy if exists "Allow public read own order placeholder" on public.orders;
drop policy if exists "Allow public read orders for dev" on public.orders;
drop policy if exists "Customers read own orders" on public.orders;
create policy "Customers read own orders"
on public.orders
for select
using (
  auth.uid() = auth_user_id
  or lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Allow public read order items for dev" on public.order_items;
drop policy if exists "Customers read own order items" on public.order_items;
create policy "Customers read own order items"
on public.order_items
for select
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and (
        auth.uid() = orders.auth_user_id
        or lower(orders.customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

drop policy if exists "Allow dashboard read notifications" on public.notifications;
create policy "Allow dashboard read notifications"
on public.notifications
for select
using (true);

drop policy if exists "Allow store create notifications" on public.notifications;
create policy "Allow store create notifications"
on public.notifications
for insert
with check (true);

drop policy if exists "Allow dashboard update notifications" on public.notifications;
create policy "Allow dashboard update notifications"
on public.notifications
for update
using (true)
with check (true);

drop policy if exists "Allow service role manage notifications" on public.notifications;
create policy "Allow service role manage notifications"
on public.notifications
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage catalog" on public.products;
create policy "Allow service role manage catalog"
on public.products
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage categories" on public.categories;
create policy "Allow service role manage categories"
on public.categories
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage collections" on public.collections;
create policy "Allow service role manage collections"
on public.collections
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage homepage banners" on public.homepage_banners;
create policy "Allow service role manage homepage banners"
on public.homepage_banners
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage discounts" on public.discounts;
create policy "Allow service role manage discounts"
on public.discounts
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Allow public select approved reviews" on public.reviews;
create policy "Allow public select approved reviews"
on public.reviews
for select
using (is_approved = true);

drop policy if exists "Customers create reviews" on public.reviews;
create policy "Customers create reviews"
on public.reviews
for insert
with check (auth.uid() = auth_user_id);

drop policy if exists "Customers manage own wishlist" on public.wishlist;
create policy "Customers manage own wishlist"
on public.wishlist
for all
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists "Allow storefront create analytics events" on public.analytics_events;
create policy "Allow storefront create analytics events"
on public.analytics_events
for insert
with check (true);

drop policy if exists "Allow service role manage reviews" on public.reviews;
create policy "Allow service role manage reviews"
on public.reviews
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage wishlist" on public.wishlist;
create policy "Allow service role manage wishlist"
on public.wishlist
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage analytics events" on public.analytics_events;
create policy "Allow service role manage analytics events"
on public.analytics_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.products;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.collections, public.homepage_banners, public.discounts, public.reviews to anon, authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert on public.orders to anon, authenticated;
grant select, insert on public.order_items to anon, authenticated;
grant select, insert, update on public.notifications to anon, authenticated;
grant select, insert on public.wishlist to authenticated;
grant insert on public.analytics_events to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

-- ===== END supabase-orders.sql =====


-- ===== BEGIN supabase-auth-safe.sql =====

create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text,
  email text unique,
  phone text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

alter table public.customers add column if not exists auth_user_id uuid unique;
alter table public.customers add column if not exists full_name text;
alter table public.customers add column if not exists email text;
alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists is_active boolean default true;
alter table public.customers add column if not exists created_at timestamp with time zone default now();

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  email text unique not null,
  role text default 'admin',
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

alter table public.admin_users add column if not exists auth_user_id uuid unique;
alter table public.admin_users add column if not exists email text;
alter table public.admin_users add column if not exists role text default 'admin';
alter table public.admin_users add column if not exists is_active boolean default true;
alter table public.admin_users add column if not exists created_at timestamp with time zone default now();

alter table public.orders add column if not exists auth_user_id uuid;
alter table public.orders add column if not exists customer_id uuid;
alter table public.wishlist add column if not exists auth_user_id uuid;
alter table public.wishlist add column if not exists session_id text;

alter table public.customers enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Customers can read own profile" on public.customers;
create policy "Customers can read own profile"
on public.customers
for select
using (auth.uid() = auth_user_id);

drop policy if exists "Customers can insert own profile" on public.customers;
create policy "Customers can insert own profile"
on public.customers
for insert
with check (auth.uid() = auth_user_id);

drop policy if exists "Customers can update own profile" on public.customers;
create policy "Customers can update own profile"
on public.customers
for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users
for select
using (auth.uid() = auth_user_id and is_active = true);

notify pgrst, 'reload schema';

-- ===== END supabase-auth-safe.sql =====


-- ===== BEGIN supabase-wishlist.sql =====

create extension if not exists "pgcrypto";

create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid,
  auth_user_id uuid,
  session_id text,
  product_id uuid references public.products(id) on delete cascade,
  created_at timestamp with time zone default now()
);

alter table public.wishlist add column if not exists customer_id uuid;
alter table public.wishlist add column if not exists auth_user_id uuid;
alter table public.wishlist add column if not exists session_id text;
alter table public.wishlist add column if not exists product_id uuid;
alter table public.wishlist add column if not exists created_at timestamp with time zone default now();

create unique index if not exists wishlist_unique_user_product
on public.wishlist (coalesce(auth_user_id::text, session_id), product_id)
where product_id is not null;

create unique index if not exists wishlist_unique_auth_user_product
on public.wishlist (auth_user_id, product_id)
where auth_user_id is not null and product_id is not null;

create unique index if not exists wishlist_unique_session_product
on public.wishlist (session_id, product_id)
where auth_user_id is null and nullif(session_id, '') is not null and product_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wishlist_has_owner'
      and conrelid = 'public.wishlist'::regclass
  ) then
    alter table public.wishlist
      add constraint wishlist_has_owner
      check (auth_user_id is not null or nullif(session_id, '') is not null)
      not valid;
  end if;
end $$;

alter table public.wishlist enable row level security;

drop policy if exists "Public can manage wishlist for dev" on public.wishlist;

create policy "Public can manage wishlist for dev"
on public.wishlist
for all
using (true)
with check (true);

notify pgrst, 'reload schema';

-- ===== END supabase-wishlist.sql =====


-- ===== BEGIN supabase-order-management-safe.sql =====

-- Radios + Dashcode order lifecycle upgrade.
-- Safe to run more than once. It only adds missing columns/tables/policies and backfills empty lifecycle fields.

create extension if not exists pgcrypto;

alter table public.orders add column if not exists order_status text default 'pending';
alter table public.orders add column if not exists payment_status text default 'pending';
alter table public.orders add column if not exists fulfillment_status text default 'unfulfilled';
alter table public.orders add column if not exists refund_status text default 'none';
alter table public.orders add column if not exists tracking_status text default 'Order Placed';
alter table public.orders add column if not exists courier_name text;
alter table public.orders add column if not exists courier_tracking_number text;
alter table public.orders add column if not exists estimated_delivery_date date;
alter table public.orders add column if not exists shipped_at timestamp with time zone;
alter table public.orders add column if not exists delivered_at timestamp with time zone;
alter table public.orders add column if not exists cancelled_at timestamp with time zone;
alter table public.orders add column if not exists refunded_at timestamp with time zone;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists refund_reason text;
alter table public.orders add column if not exists admin_notes text;
alter table public.orders add column if not exists invoice_number text unique;
alter table public.orders add column if not exists invoice_url text;
alter table public.orders add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  status text not null,
  status_type text default 'order',
  note text,
  created_by text default 'system',
  created_at timestamp with time zone default now()
);

create table if not exists public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  refund_amount numeric default 0,
  refund_reason text,
  refund_status text default 'requested',
  processed_by text,
  created_at timestamp with time zone default now(),
  processed_at timestamp with time zone
);

create table if not exists public.order_cancellations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  cancellation_reason text,
  cancelled_by text default 'customer',
  created_at timestamp with time zone default now()
);

update public.orders
set
  order_status = coalesce(nullif(order_status, ''), nullif(status, ''), 'pending'),
  payment_status = coalesce(
    nullif(payment_status, ''),
    case when payment_method = 'cash_on_delivery' then 'cod_pending' else 'pending' end
  ),
  fulfillment_status = coalesce(
    nullif(fulfillment_status, ''),
    case
      when shipping_status in ('delivered', 'returned') then shipping_status
      when shipping_status in ('in_transit', 'out_for_delivery') then 'partially_fulfilled'
      else 'unfulfilled'
    end
  ),
  refund_status = coalesce(nullif(refund_status, ''), 'none'),
  tracking_status = coalesce(nullif(tracking_status, ''), 'Order Placed'),
  courier_name = coalesce(nullif(courier_name, ''), nullif(courier, '')),
  courier_tracking_number = coalesce(nullif(courier_tracking_number, ''), nullif(tracking_id, '')),
  updated_at = coalesce(updated_at, created_at, now())
where true;

update public.orders
set invoice_number = 'INV-' || to_char(coalesce(created_at, now()), 'YYYYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 6))
where invoice_number is null or invoice_number = '';

insert into public.order_status_history (order_id, status, status_type, note, created_by, created_at)
select
  o.id,
  coalesce(nullif(o.order_status, ''), nullif(o.status, ''), 'pending'),
  'order',
  'Order placed successfully',
  'system',
  coalesce(o.created_at, now())
from public.orders o
where not exists (
  select 1
  from public.order_status_history h
  where h.order_id = o.id
    and h.status_type = 'order'
);

alter table public.order_status_history enable row level security;
alter table public.order_refunds enable row level security;
alter table public.order_cancellations enable row level security;

drop policy if exists "Public can read order status history" on public.order_status_history;
create policy "Public can read order status history"
on public.order_status_history
for select
using (true);

drop policy if exists "Dashboard can manage order status history" on public.order_status_history;
create policy "Dashboard can manage order status history"
on public.order_status_history
for all
using (true)
with check (true);

drop policy if exists "Dashboard can manage refunds" on public.order_refunds;
create policy "Dashboard can manage refunds"
on public.order_refunds
for all
using (true)
with check (true);

drop policy if exists "Dashboard can manage cancellations" on public.order_cancellations;
create policy "Dashboard can manage cancellations"
on public.order_cancellations
for all
using (true)
with check (true);

do $$
begin
  alter publication supabase_realtime add table public.order_status_history;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.order_refunds;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.order_cancellations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

grant select, insert on public.order_status_history to anon, authenticated;
grant select, insert, update on public.order_refunds to anon, authenticated;
grant select, insert, update on public.order_cancellations to anon, authenticated;

notify pgrst, 'reload schema';

-- ===== END supabase-order-management-safe.sql =====


-- ===== BEGIN supabase-storage-safe.sql =====

-- Supabase Storage setup for Radios storefront images.
-- Run this in the Supabase SQL editor after supabase-auth-safe.sql so admin_users exists.

create extension if not exists "pgcrypto";

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  email text unique not null,
  role text default 'admin',
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Admins can read own admin row" on public.admin_users;

create policy "Admins can read own admin row"
on public.admin_users
for select
using (auth.uid() = auth_user_id and is_active = true);

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('banner-images', 'banner-images', true),
  ('category-images', 'category-images', true)
on conflict (id) do update
set public = excluded.public;

do $$
begin
  if to_regclass('public.products') is not null then
    alter table public.products add column if not exists image_url text;
    alter table public.products add column if not exists images text[];
  end if;

  if to_regclass('public.categories') is not null then
    alter table public.categories add column if not exists image_url text;
    alter table public.categories add column if not exists banner_url text;
  end if;

  if to_regclass('public.collections') is not null then
    alter table public.collections add column if not exists image_url text;
  end if;

  if to_regclass('public.homepage_banners') is not null then
    alter table public.homepage_banners add column if not exists image_url text;
  end if;
end $$;

drop policy if exists "Public can read storefront images" on storage.objects;
drop policy if exists "Admins can upload storefront images" on storage.objects;
drop policy if exists "Admins can update storefront images" on storage.objects;
drop policy if exists "Admins can delete storefront images" on storage.objects;

create policy "Public can read storefront images"
on storage.objects
for select
using (bucket_id in ('product-images', 'banner-images', 'category-images'));

create policy "Admins can upload storefront images"
on storage.objects
for insert
with check (
  bucket_id in ('product-images', 'banner-images', 'category-images')
  and exists (
    select 1
    from public.admin_users admin
    where admin.auth_user_id = auth.uid()
      and admin.is_active = true
      and admin.role in ('admin', 'manager')
  )
);

create policy "Admins can update storefront images"
on storage.objects
for update
using (
  bucket_id in ('product-images', 'banner-images', 'category-images')
  and exists (
    select 1
    from public.admin_users admin
    where admin.auth_user_id = auth.uid()
      and admin.is_active = true
      and admin.role in ('admin', 'manager')
  )
)
with check (
  bucket_id in ('product-images', 'banner-images', 'category-images')
  and exists (
    select 1
    from public.admin_users admin
    where admin.auth_user_id = auth.uid()
      and admin.is_active = true
      and admin.role in ('admin', 'manager')
  )
);

create policy "Admins can delete storefront images"
on storage.objects
for delete
using (
  bucket_id in ('product-images', 'banner-images', 'category-images')
  and exists (
    select 1
    from public.admin_users admin
    where admin.auth_user_id = auth.uid()
      and admin.is_active = true
      and admin.role in ('admin', 'manager')
  )
);

do $$
begin
  if to_regclass('public.products') is not null then
    execute 'drop policy if exists "Admins can update product images" on public.products';
    execute $policy$
      create policy "Admins can update product images"
      on public.products
      for update
      using (
        exists (
          select 1 from public.admin_users admin
          where admin.auth_user_id = auth.uid()
            and admin.is_active = true
            and admin.role in ('admin', 'manager')
        )
      )
      with check (
        exists (
          select 1 from public.admin_users admin
          where admin.auth_user_id = auth.uid()
            and admin.is_active = true
            and admin.role in ('admin', 'manager')
        )
      )
    $policy$;
  end if;

  if to_regclass('public.categories') is not null then
    execute 'drop policy if exists "Admins can update category images" on public.categories';
    execute $policy$
      create policy "Admins can update category images"
      on public.categories
      for update
      using (
        exists (
          select 1 from public.admin_users admin
          where admin.auth_user_id = auth.uid()
            and admin.is_active = true
            and admin.role in ('admin', 'manager')
        )
      )
      with check (
        exists (
          select 1 from public.admin_users admin
          where admin.auth_user_id = auth.uid()
            and admin.is_active = true
            and admin.role in ('admin', 'manager')
        )
      )
    $policy$;
  end if;

  if to_regclass('public.collections') is not null then
    execute 'drop policy if exists "Admins can update collection images" on public.collections';
    execute $policy$
      create policy "Admins can update collection images"
      on public.collections
      for update
      using (
        exists (
          select 1 from public.admin_users admin
          where admin.auth_user_id = auth.uid()
            and admin.is_active = true
            and admin.role in ('admin', 'manager')
        )
      )
      with check (
        exists (
          select 1 from public.admin_users admin
          where admin.auth_user_id = auth.uid()
            and admin.is_active = true
            and admin.role in ('admin', 'manager')
        )
      )
    $policy$;
  end if;

  if to_regclass('public.homepage_banners') is not null then
    execute 'drop policy if exists "Admins can update homepage banner images" on public.homepage_banners';
    execute $policy$
      create policy "Admins can update homepage banner images"
      on public.homepage_banners
      for update
      using (
        exists (
          select 1 from public.admin_users admin
          where admin.auth_user_id = auth.uid()
            and admin.is_active = true
            and admin.role in ('admin', 'manager')
        )
      )
      with check (
        exists (
          select 1 from public.admin_users admin
          where admin.auth_user_id = auth.uid()
            and admin.is_active = true
            and admin.role in ('admin', 'manager')
        )
      )
    $policy$;
  end if;
end $$;

notify pgrst, 'reload schema';

-- ===== END supabase-storage-safe.sql =====


-- ===== BEGIN supabase-inventory-safe.sql =====

-- Production inventory management for Radios.
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

-- ===== END supabase-inventory-safe.sql =====


-- ===== BEGIN supabase-customer-accounts-safe.sql =====

-- Radios customer account area.
-- Safe to run multiple times. Does not drop or delete existing data.

create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text,
  email text unique,
  phone text,
  avatar_url text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.customers add column if not exists auth_user_id uuid unique;
alter table public.customers add column if not exists full_name text;
alter table public.customers add column if not exists email text;
alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists avatar_url text;
alter table public.customers add column if not exists is_active boolean default true;
alter table public.customers add column if not exists created_at timestamp with time zone default now();
alter table public.customers add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  email text unique not null,
  role text default 'admin',
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

alter table public.admin_users add column if not exists auth_user_id uuid unique;
alter table public.admin_users add column if not exists email text;
alter table public.admin_users add column if not exists role text default 'admin';
alter table public.admin_users add column if not exists is_active boolean default true;
alter table public.admin_users add column if not exists created_at timestamp with time zone default now();

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  customer_id uuid references public.customers(id) on delete cascade,
  full_name text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  country text default 'India',
  address_type text default 'home',
  is_default boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.customer_addresses add column if not exists auth_user_id uuid;
alter table public.customer_addresses add column if not exists customer_id uuid;
alter table public.customer_addresses add column if not exists full_name text;
alter table public.customer_addresses add column if not exists phone text;
alter table public.customer_addresses add column if not exists address_line1 text;
alter table public.customer_addresses add column if not exists address_line2 text;
alter table public.customer_addresses add column if not exists city text;
alter table public.customer_addresses add column if not exists state text;
alter table public.customer_addresses add column if not exists pincode text;
alter table public.customer_addresses add column if not exists country text default 'India';
alter table public.customer_addresses add column if not exists address_type text default 'home';
alter table public.customer_addresses add column if not exists is_default boolean default false;
alter table public.customer_addresses add column if not exists created_at timestamp with time zone default now();
alter table public.customer_addresses add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  auth_user_id uuid,
  customer_name text,
  customer_email text,
  reason text,
  status text default 'requested',
  admin_note text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.return_requests add column if not exists order_id uuid;
alter table public.return_requests add column if not exists auth_user_id uuid;
alter table public.return_requests add column if not exists customer_name text;
alter table public.return_requests add column if not exists customer_email text;
alter table public.return_requests add column if not exists reason text;
alter table public.return_requests add column if not exists status text default 'requested';
alter table public.return_requests add column if not exists admin_note text;
alter table public.return_requests add column if not exists created_at timestamp with time zone default now();
alter table public.return_requests add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  title text not null,
  message text,
  type text default 'account',
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

alter table public.customer_notifications add column if not exists auth_user_id uuid;
alter table public.customer_notifications add column if not exists title text;
alter table public.customer_notifications add column if not exists message text;
alter table public.customer_notifications add column if not exists type text default 'account';
alter table public.customer_notifications add column if not exists is_read boolean default false;
alter table public.customer_notifications add column if not exists created_at timestamp with time zone default now();

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  order_id uuid,
  product_id uuid,
  rating integer,
  title text,
  comment text,
  status text default 'pending',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.reviews add column if not exists auth_user_id uuid;
alter table public.reviews add column if not exists order_id uuid;
alter table public.reviews add column if not exists product_id uuid;
alter table public.reviews add column if not exists rating integer;
alter table public.reviews add column if not exists title text;
alter table public.reviews add column if not exists comment text;
alter table public.reviews add column if not exists status text default 'pending';
alter table public.reviews add column if not exists created_at timestamp with time zone default now();
alter table public.reviews add column if not exists updated_at timestamp with time zone default now();

alter table public.orders add column if not exists auth_user_id uuid;
alter table public.orders add column if not exists customer_id uuid;
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists tracking_id text;
alter table public.orders add column if not exists payment_status text;

create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid,
  auth_user_id uuid,
  session_id text,
  product_id uuid references public.products(id) on delete cascade,
  created_at timestamp with time zone default now()
);

alter table public.wishlist add column if not exists auth_user_id uuid;
alter table public.wishlist add column if not exists customer_id uuid;
alter table public.wishlist add column if not exists session_id text;

create index if not exists customers_auth_user_id_idx on public.customers (auth_user_id);
create index if not exists customers_email_idx on public.customers (email);
create index if not exists customer_addresses_auth_user_id_idx on public.customer_addresses (auth_user_id);
create index if not exists customer_addresses_customer_id_idx on public.customer_addresses (customer_id);
create index if not exists return_requests_auth_user_id_idx on public.return_requests (auth_user_id);
create index if not exists return_requests_order_id_idx on public.return_requests (order_id);
create index if not exists customer_notifications_auth_user_id_idx on public.customer_notifications (auth_user_id, is_read);
create index if not exists reviews_auth_user_id_idx on public.reviews (auth_user_id);
create index if not exists reviews_product_id_idx on public.reviews (product_id);
drop index if exists public.customer_addresses_single_default_idx;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at
before update on public.customers
for each row execute function public.touch_updated_at();

drop trigger if exists customer_addresses_touch_updated_at on public.customer_addresses;
create trigger customer_addresses_touch_updated_at
before update on public.customer_addresses
for each row execute function public.touch_updated_at();

drop trigger if exists return_requests_touch_updated_at on public.return_requests;
create trigger return_requests_touch_updated_at
before update on public.return_requests
for each row execute function public.touch_updated_at();

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
before update on public.reviews
for each row execute function public.touch_updated_at();

create or replace function public.ensure_single_default_customer_address()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_default = true and new.auth_user_id is not null then
    update public.customer_addresses
    set is_default = false
    where auth_user_id = new.auth_user_id
      and id <> new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists customer_addresses_single_default_trigger on public.customer_addresses;
create trigger customer_addresses_single_default_trigger
after insert or update of is_default, auth_user_id
on public.customer_addresses
for each row
execute function public.ensure_single_default_customer_address();

create or replace function public.is_account_admin()
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
        and admin.role in ('admin', 'manager', 'staff')
    );
$$;

create or replace function public.send_customer_notification(
  p_auth_user_id uuid,
  p_title text,
  p_message text default null,
  p_type text default 'account'
)
returns public.customer_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  notification public.customer_notifications;
begin
  if public.is_account_admin() = false then
    raise exception 'Not authorized to send customer notifications';
  end if;

  insert into public.customer_notifications (auth_user_id, title, message, type, is_read)
  values (p_auth_user_id, p_title, p_message, coalesce(nullif(p_type, ''), 'account'), false)
  returning * into notification;

  return notification;
end;
$$;

create or replace function public.delete_my_customer_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_customer_id uuid;
begin
  if v_auth_user_id is null then
    raise exception 'You must be signed in to delete your account';
  end if;

  select id
  into v_customer_id
  from public.customers
  where auth_user_id = v_auth_user_id
  limit 1;

  delete from public.customer_addresses
  where auth_user_id = v_auth_user_id
     or (v_customer_id is not null and customer_id = v_customer_id);

  delete from public.wishlist
  where auth_user_id = v_auth_user_id
     or (v_customer_id is not null and customer_id = v_customer_id);

  delete from public.customer_notifications
  where auth_user_id = v_auth_user_id;

  delete from public.reviews
  where auth_user_id = v_auth_user_id;

  delete from public.return_requests
  where auth_user_id = v_auth_user_id;

  update public.orders
  set auth_user_id = null,
      customer_id = null
  where auth_user_id = v_auth_user_id
     or (v_customer_id is not null and customer_id = v_customer_id);

  delete from public.customers
  where auth_user_id = v_auth_user_id;

  delete from auth.users
  where id = v_auth_user_id;

  return jsonb_build_object('deleted', true);
end;
$$;

alter table public.customers enable row level security;
alter table public.admin_users enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.return_requests enable row level security;
alter table public.customer_notifications enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row"
on public.admin_users for select
using (auth.uid() = auth_user_id and is_active = true);

drop policy if exists "Customers can read own profile" on public.customers;
create policy "Customers can read own profile"
on public.customers for select
using (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers can insert own profile" on public.customers;
create policy "Customers can insert own profile"
on public.customers for insert
with check (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers can update own profile" on public.customers;
create policy "Customers can update own profile"
on public.customers for update
using (auth.uid() = auth_user_id or public.is_account_admin())
with check (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers manage own addresses" on public.customer_addresses;
create policy "Customers manage own addresses"
on public.customer_addresses for all
using (auth.uid() = auth_user_id or public.is_account_admin())
with check (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers manage own returns" on public.return_requests;
create policy "Customers manage own returns"
on public.return_requests for all
using (auth.uid() = auth_user_id or public.is_account_admin())
with check (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers read own notifications" on public.customer_notifications;
create policy "Customers read own notifications"
on public.customer_notifications for select
using (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers update own notifications" on public.customer_notifications;
create policy "Customers update own notifications"
on public.customer_notifications for update
using (auth.uid() = auth_user_id or public.is_account_admin())
with check (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers manage own reviews" on public.reviews;
create policy "Customers manage own reviews"
on public.reviews for all
using (auth.uid() = auth_user_id or public.is_account_admin())
with check (auth.uid() = auth_user_id or public.is_account_admin());

grant select, insert, update on public.customers to authenticated;
grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;
grant select, insert, update on public.return_requests to authenticated;
grant select, update on public.customer_notifications to authenticated;
grant select, insert, update, delete on public.reviews to authenticated;
grant execute on function public.send_customer_notification(uuid, text, text, text) to authenticated;
grant execute on function public.delete_my_customer_account() to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.customer_notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.return_requests;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';

-- ===== END supabase-customer-accounts-safe.sql =====


-- ===== BEGIN supabase-storefront-badges.sql =====

-- Optional storefront merchandising badge fields for Radios products.
-- Run this if product badges are managed directly in Supabase/Dashcode.

alter table public.products add column if not exists badges text[] default '{}'::text[];
alter table public.products add column if not exists tags text[] default '{}'::text[];
alter table public.products add column if not exists is_hot boolean default false;
alter table public.products add column if not exists is_best_seller boolean default false;
alter table public.products add column if not exists is_featured boolean default false;
alter table public.products add column if not exists is_new boolean default false;
alter table public.products add column if not exists sales_count integer default 0;
alter table public.products add column if not exists compare_at_price numeric default 0;

create index if not exists products_storefront_badges_gin_idx on public.products using gin (badges);
create index if not exists products_storefront_tags_gin_idx on public.products using gin (tags);
create index if not exists products_storefront_merchandising_idx
on public.products (is_hot, is_best_seller, is_featured, is_new);

do $$
begin
  if to_regclass('public.admin_users') is not null then
    execute 'drop policy if exists "Admins can update product storefront badges" on public.products';
    execute $policy$
      create policy "Admins can update product storefront badges"
      on public.products
      for update
      using (
        auth.role() = 'service_role'
        or exists (
          select 1
          from public.admin_users admin
          where admin.auth_user_id = auth.uid()
            and admin.is_active = true
            and admin.role in ('admin', 'manager')
        )
      )
      with check (
        auth.role() = 'service_role'
        or exists (
          select 1
          from public.admin_users admin
          where admin.auth_user_id = auth.uid()
            and admin.is_active = true
            and admin.role in ('admin', 'manager')
        )
      )
    $policy$;
  end if;
end $$;

notify pgrst, 'reload schema';

-- ===== END supabase-storefront-badges.sql =====


-- ===== BEGIN supabase-reviews-safe.sql =====

-- Radios verified product reviews.
-- Safe to run more than once. It preserves existing review rows and upgrades the table shape.

create extension if not exists pgcrypto;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reviews'
      and column_name = 'product_id'
      and udt_name <> 'uuid'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'reviews'
        and column_name = 'legacy_product_id'
    ) then
      alter table public.reviews rename column product_id to legacy_product_id;
    end if;
  end if;
end $$;

alter table public.orders add column if not exists auth_user_id uuid;
alter table public.orders add column if not exists order_status text default 'pending';
alter table public.orders add column if not exists shipping_status text default 'not_shipped';
alter table public.orders add column if not exists fulfillment_status text default 'unfulfilled';
alter table public.orders add column if not exists tracking_status text;
alter table public.orders add column if not exists delivered_at timestamp with time zone;

alter table public.order_items add column if not exists product_id uuid;
alter table public.order_items add column if not exists order_id uuid references public.orders(id) on delete cascade;

alter table public.reviews add column if not exists product_id uuid references public.products(id) on delete cascade;
alter table public.reviews add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.reviews add column if not exists auth_user_id uuid;
alter table public.reviews add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.reviews add column if not exists customer_name text;
alter table public.reviews add column if not exists customer_email text;
alter table public.reviews add column if not exists rating integer default 5;
alter table public.reviews add column if not exists title text;
alter table public.reviews add column if not exists comment text;
alter table public.reviews add column if not exists body text;
alter table public.reviews add column if not exists image_urls text[] default '{}'::text[];
alter table public.reviews add column if not exists is_verified_purchase boolean default false;
alter table public.reviews add column if not exists is_approved boolean default false;
alter table public.reviews add column if not exists moderation_status text default 'pending';
alter table public.reviews add column if not exists status text default 'pending';
alter table public.reviews add column if not exists admin_note text;
alter table public.reviews add column if not exists updated_at timestamp with time zone default now();

update public.reviews
set comment = coalesce(nullif(comment, ''), nullif(body, ''))
where comment is null or comment = '';

update public.reviews
set
  moderation_status = coalesce(nullif(moderation_status, ''), nullif(status, ''), case when is_approved then 'approved' else 'pending' end),
  status = coalesce(nullif(status, ''), nullif(moderation_status, ''), case when is_approved then 'approved' else 'pending' end),
  image_urls = coalesce(image_urls, '{}'::text[]),
  rating = least(5, greatest(1, coalesce(rating, 5))),
  updated_at = coalesce(updated_at, created_at, now())
where true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_rating_range'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
    add constraint reviews_rating_range check (rating between 1 and 5);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_moderation_status_check'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
    add constraint reviews_moderation_status_check check (moderation_status in ('pending', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_image_urls_limit'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
    add constraint reviews_image_urls_limit check (coalesce(array_length(image_urls, 1), 0) <= 3);
  end if;
end $$;

create unique index if not exists reviews_unique_order_product_user
on public.reviews(order_id, product_id, auth_user_id)
where order_id is not null and product_id is not null and auth_user_id is not null;

create index if not exists reviews_product_approved_idx
on public.reviews(product_id, is_approved, moderation_status, created_at desc);

create index if not exists reviews_moderation_status_idx
on public.reviews(moderation_status, created_at desc);

create or replace function public.touch_review_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.status := coalesce(nullif(new.moderation_status, ''), new.status, 'pending');
  new.is_approved := new.moderation_status = 'approved';
  return new;
end;
$$;

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
before update on public.reviews
for each row
execute function public.touch_review_updated_at();

create or replace function public.is_reviews_admin()
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
        and admin.role in ('admin', 'manager', 'staff')
    );
$$;

create or replace function public.review_order_is_delivered(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.auth_user_id = auth.uid()
      and (
        lower(coalesce(o.order_status, '')) = 'delivered'
        or lower(coalesce(o.status, '')) = 'delivered'
        or lower(coalesce(o.shipping_status, '')) = 'delivered'
        or lower(coalesce(o.fulfillment_status, '')) = 'delivered'
        or lower(coalesce(o.tracking_status, '')) like '%delivered%'
        or o.delivered_at is not null
      )
  );
$$;

create or replace function public.review_is_verified_purchase(p_order_id uuid, p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.review_order_is_delivered(p_order_id)
    and exists (
      select 1
      from public.order_items item
      where item.order_id = p_order_id
        and item.product_id = p_product_id
    );
$$;

insert into storage.buckets (id, name, public)
values ('review-images', 'review-images', true)
on conflict (id) do update set public = excluded.public;

alter table public.reviews enable row level security;

drop policy if exists "Public can read approved reviews" on public.reviews;
create policy "Public can read approved reviews"
on public.reviews
for select
using (is_approved = true and moderation_status = 'approved');

drop policy if exists "Customers can read own reviews" on public.reviews;
create policy "Customers can read own reviews"
on public.reviews
for select
using (auth.uid() = auth_user_id);

drop policy if exists "Verified buyers can create reviews" on public.reviews;
create policy "Verified buyers can create reviews"
on public.reviews
for insert
with check (
  auth.uid() = auth_user_id
  and is_verified_purchase = true
  and is_approved = false
  and moderation_status = 'pending'
  and public.review_is_verified_purchase(order_id, product_id)
);

drop policy if exists "Review admins can manage reviews" on public.reviews;
create policy "Review admins can manage reviews"
on public.reviews
for all
using (public.is_reviews_admin())
with check (public.is_reviews_admin());

drop policy if exists "Customers can read own delivered orders for reviews" on public.orders;
create policy "Customers can read own delivered orders for reviews"
on public.orders
for select
using (
  auth.uid() = auth_user_id
  or lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Customers can read own delivered order items for reviews" on public.order_items;
create policy "Customers can read own delivered order items for reviews"
on public.order_items
for select
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        auth.uid() = o.auth_user_id
        or lower(o.customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

drop policy if exists "Public can read review images" on storage.objects;
create policy "Public can read review images"
on storage.objects
for select
using (bucket_id = 'review-images');

drop policy if exists "Authenticated customers can upload review images" on storage.objects;
create policy "Authenticated customers can upload review images"
on storage.objects
for insert
with check (
  bucket_id = 'review-images'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(name) ~ '\.(jpg|jpeg|png|webp)$'
);

drop policy if exists "Customers can manage own review images" on storage.objects;
create policy "Customers can manage own review images"
on storage.objects
for delete
using (
  bucket_id = 'review-images'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

grant execute on function public.review_order_is_delivered(uuid) to authenticated;
grant execute on function public.review_is_verified_purchase(uuid, uuid) to authenticated;
grant select, insert on public.reviews to anon, authenticated;
grant update, delete on public.reviews to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.reviews;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';

-- ===== END supabase-reviews-safe.sql =====


-- ===== BEGIN supabase-smart-search-safe.sql =====

-- Radios smart product search.
-- Safe to run more than once. Adds typo-tolerant search, analytics, and admin-editable keywords.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

alter table public.products add column if not exists title text;
alter table public.products add column if not exists name text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists price numeric(12,2) default 0;
alter table public.products add column if not exists compare_at_price numeric(12,2);
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists image text;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists category_slug text;
alter table public.products add column if not exists tags text[] default '{}'::text[];
alter table public.products add column if not exists visible boolean default true;
alter table public.products add column if not exists is_active boolean default true;
alter table public.products add column if not exists status text default 'active';
alter table public.products add column if not exists search_keywords text;
alter table public.products add column if not exists search_vector tsvector;

create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  session_id text,
  auth_user_id uuid,
  results_count integer default 0,
  clicked_product_id uuid references public.products(id) on delete set null,
  created_at timestamp with time zone default now()
);

create index if not exists products_search_vector_idx on public.products using gin(search_vector);
create index if not exists products_title_trgm_idx on public.products using gin(title gin_trgm_ops);
create index if not exists products_name_trgm_idx on public.products using gin(name gin_trgm_ops);
create index if not exists products_search_keywords_trgm_idx on public.products using gin(search_keywords gin_trgm_ops);
create index if not exists search_events_query_idx on public.search_events(query);
create index if not exists search_events_created_at_idx on public.search_events(created_at desc);
create index if not exists search_events_clicked_product_idx on public.search_events(clicked_product_id);

create or replace function public.products_search_document(p_product public.products)
returns text
language sql
immutable
as $$
  select trim(concat_ws(' ',
    p_product.title,
    p_product.name,
    p_product.description,
    p_product.sku,
    p_product.category,
    p_product.category_slug,
    p_product.search_keywords,
    array_to_string(p_product.tags, ' ')
  ));
$$;

create or replace function public.refresh_product_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.category, '') || ' ' || coalesce(new.category_slug, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.sku, '') || ' ' || coalesce(array_to_string(new.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.description, '') || ' ' || coalesce(new.search_keywords, '')), 'C');
  return new;
end;
$$;

drop trigger if exists products_refresh_search_vector on public.products;
create trigger products_refresh_search_vector
before insert or update of title, name, description, sku, category, category_slug, tags, search_keywords
on public.products
for each row
execute function public.refresh_product_search_vector();

update public.products
set search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(category, '') || ' ' || coalesce(category_slug, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(sku, '') || ' ' || coalesce(array_to_string(tags, ' '), '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(description, '') || ' ' || coalesce(search_keywords, '')), 'C')
where true;

create or replace function public.search_products(
  search_query text,
  category_filter text default null,
  limit_count integer default 10
)
returns table (
  id uuid,
  title text,
  name text,
  price numeric,
  compare_at_price numeric,
  image_url text,
  image text,
  category text,
  category_slug text,
  similarity_score real
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      lower(trim(coalesce(search_query, ''))) as q,
      nullif(lower(trim(coalesce(category_filter, ''))), '') as cat,
      greatest(1, least(coalesce(limit_count, 10), 50)) as max_rows
  ),
  matched as (
    select
      p.id,
      p.title,
      p.name,
      p.price,
      p.compare_at_price,
      p.image_url,
      p.image,
      p.category,
      p.category_slug,
      greatest(
        similarity(lower(coalesce(p.title, '')), n.q),
        similarity(lower(coalesce(p.name, '')), n.q),
        similarity(lower(coalesce(p.category, '')), n.q),
        similarity(lower(coalesce(p.category_slug, '')), n.q),
        similarity(lower(coalesce(p.search_keywords, '')), n.q),
        similarity(lower(coalesce(p.sku, '')), n.q),
        similarity(lower(coalesce(array_to_string(p.tags, ' '), '')), n.q)
      )::real as similarity_score,
      case
        when lower(coalesce(p.title, '')) = n.q or lower(coalesce(p.name, '')) = n.q then 1
        when lower(coalesce(p.title, '')) like n.q || '%' or lower(coalesce(p.name, '')) like n.q || '%' then 2
        when lower(coalesce(p.category_slug, '')) = n.q or lower(coalesce(p.category, '')) = n.q then 3
        when lower(coalesce(array_to_string(p.tags, ' '), '')) like '%' || n.q || '%' then 4
        else 5
      end as priority
    from public.products p
    cross join normalized n
    where length(n.q) >= 2
      and (coalesce(p.visible, false) = true or coalesce(p.is_active, false) = true)
      and lower(coalesce(p.status, 'active')) not in ('draft', 'hidden', 'archived', 'inactive', 'unpublished', 'disabled', 'deleted')
      and (
        n.cat is null
        or lower(coalesce(p.category_slug, '')) = n.cat
        or lower(regexp_replace(coalesce(p.category, ''), '[^a-zA-Z0-9]+', '-', 'g')) = n.cat
      )
      and (
        p.search_vector @@ plainto_tsquery('simple', n.q)
        or lower(public.products_search_document(p)) like '%' || n.q || '%'
        or similarity(lower(coalesce(p.title, '')), n.q) > 0.22
        or similarity(lower(coalesce(p.name, '')), n.q) > 0.22
        or similarity(lower(coalesce(p.search_keywords, '')), n.q) > 0.22
        or similarity(lower(coalesce(p.sku, '')), n.q) > 0.22
        or similarity(lower(coalesce(array_to_string(p.tags, ' '), '')), n.q) > 0.22
      )
  )
  select
    matched.id,
    matched.title,
    matched.name,
    matched.price,
    matched.compare_at_price,
    matched.image_url,
    matched.image,
    matched.category,
    matched.category_slug,
    matched.similarity_score
  from matched
  cross join normalized n
  order by matched.priority asc, matched.similarity_score desc, coalesce(matched.title, matched.name) asc
  limit (select max_rows from normalized);
$$;

create or replace function public.get_trending_searches(limit_count integer default 5)
returns table (
  query text,
  search_count bigint,
  last_searched_at timestamp with time zone
)
language sql
stable
security definer
set search_path = public
as $$
  select
    trim(query) as query,
    count(*) as search_count,
    max(created_at) as last_searched_at
  from public.search_events
  where created_at >= now() - interval '30 days'
    and clicked_product_id is null
    and length(trim(query)) >= 2
  group by trim(query)
  order by search_count desc, last_searched_at desc
  limit greatest(1, least(coalesce(limit_count, 5), 10));
$$;

create or replace function public.search_events_admin_allowed()
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
        and admin.role in ('admin', 'manager', 'staff')
    );
$$;

alter table public.search_events enable row level security;

drop policy if exists "Storefront can create search events" on public.search_events;
create policy "Storefront can create search events"
on public.search_events
for insert
with check (true);

drop policy if exists "Review search analytics admins can read search events" on public.search_events;
drop policy if exists "Search analytics admins can read search events" on public.search_events;
create policy "Search analytics admins can read search events"
on public.search_events
for select
using (public.search_events_admin_allowed());

drop policy if exists "Admins can update product search keywords" on public.products;
create policy "Admins can update product search keywords"
on public.products
for update
using (public.search_events_admin_allowed())
with check (public.search_events_admin_allowed());

grant execute on function public.search_products(text, text, integer) to anon, authenticated;
grant execute on function public.get_trending_searches(integer) to anon, authenticated;
grant insert on public.search_events to anon, authenticated;
grant select on public.search_events to authenticated;
grant update(search_keywords) on public.products to authenticated;

notify pgrst, 'reload schema';

-- ===== END supabase-smart-search-safe.sql =====


-- ===== BEGIN supabase-product-detail-safe.sql =====

-- Radios production product detail fields.
-- Safe to run more than once. Adds gallery, specifications, FAQs, delivery, policy, warranty, brand, and manual related products.

alter table public.products add column if not exists images text[] default '{}'::text[];
alter table public.products add column if not exists specifications jsonb default '{}'::jsonb;
alter table public.products add column if not exists faqs jsonb default '[]'::jsonb;
alter table public.products add column if not exists delivery_days_min integer default 2;
alter table public.products add column if not exists delivery_days_max integer default 7;
alter table public.products add column if not exists return_policy text;
alter table public.products add column if not exists warranty text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists related_product_ids uuid[] default '{}'::uuid[];

update public.products
set
  images = coalesce(images, '{}'::text[]),
  specifications = coalesce(specifications, '{}'::jsonb),
  faqs = coalesce(faqs, '[]'::jsonb),
  delivery_days_min = coalesce(delivery_days_min, 2),
  delivery_days_max = greatest(coalesce(delivery_days_max, 7), coalesce(delivery_days_min, 2)),
  related_product_ids = coalesce(related_product_ids, '{}'::uuid[])
where true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_delivery_days_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
    add constraint products_delivery_days_check check (
      delivery_days_min >= 0
      and delivery_days_max >= delivery_days_min
      and delivery_days_max <= 60
    );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_specifications_object_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
    add constraint products_specifications_object_check check (jsonb_typeof(specifications) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_faqs_array_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
    add constraint products_faqs_array_check check (jsonb_typeof(faqs) = 'array');
  end if;
end $$;

create index if not exists products_related_product_ids_gin_idx
on public.products using gin(related_product_ids);

create or replace function public.product_detail_admin_allowed()
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

drop policy if exists "Admins can update product detail content" on public.products;
create policy "Admins can update product detail content"
on public.products
for update
using (public.product_detail_admin_allowed())
with check (public.product_detail_admin_allowed());

grant update(
  images,
  specifications,
  faqs,
  delivery_days_min,
  delivery_days_max,
  return_policy,
  warranty,
  brand,
  related_product_ids
) on public.products to authenticated;

notify pgrst, 'reload schema';

-- ===== END supabase-product-detail-safe.sql =====


-- ===== BEGIN supabase-promotions-safe.sql =====

-- Radios advanced coupons and promotions engine.
-- Safe to run more than once. Adds Supabase-backed promotion rules, checkout validation RPCs,
-- redemption tracking, and admin-only management policies.

create extension if not exists pgcrypto;

create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid()
);

alter table public.discounts add column if not exists code text;
alter table public.discounts add column if not exists title text;
alter table public.discounts add column if not exists description text;
alter table public.discounts add column if not exists discount_type text default 'percentage';
alter table public.discounts add column if not exists discount_value numeric default 0;
alter table public.discounts add column if not exists promotion_type text default 'coupon_code';
alter table public.discounts add column if not exists applies_to text default 'all';
alter table public.discounts add column if not exists product_ids uuid[] default '{}'::uuid[];
alter table public.discounts add column if not exists category_ids uuid[] default '{}'::uuid[];
alter table public.discounts add column if not exists category_slugs text[] default '{}'::text[];
alter table public.discounts add column if not exists collection_ids uuid[] default '{}'::uuid[];
alter table public.discounts add column if not exists tags text[] default '{}'::text[];
alter table public.discounts add column if not exists minimum_order_amount numeric default 0;
alter table public.discounts add column if not exists maximum_discount_amount numeric;
alter table public.discounts add column if not exists usage_limit integer;
alter table public.discounts add column if not exists used_count integer default 0;
alter table public.discounts add column if not exists usage_limit_per_customer integer default 1;
alter table public.discounts add column if not exists starts_at timestamp with time zone default now();
alter table public.discounts add column if not exists expires_at timestamp with time zone;
alter table public.discounts add column if not exists is_active boolean default true;
alter table public.discounts add column if not exists is_first_order_only boolean default false;
alter table public.discounts add column if not exists buy_quantity integer default 1;
alter table public.discounts add column if not exists get_quantity integer default 1;
alter table public.discounts add column if not exists combine_with_other_discounts boolean default false;
alter table public.discounts add column if not exists created_at timestamp with time zone default now();
alter table public.discounts add column if not exists updated_at timestamp with time zone default now();

alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_id uuid;
alter table public.orders add column if not exists discount_amount numeric default 0;
alter table public.orders add column if not exists promotion_title text;
alter table public.orders add column if not exists auth_user_id uuid;

create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid references public.discounts(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  auth_user_id uuid,
  customer_email text,
  code text,
  discount_amount numeric default 0,
  created_at timestamp with time zone default now()
);

alter table public.discount_redemptions add column if not exists discount_id uuid references public.discounts(id) on delete cascade;
alter table public.discount_redemptions add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.discount_redemptions add column if not exists auth_user_id uuid;
alter table public.discount_redemptions add column if not exists customer_email text;
alter table public.discount_redemptions add column if not exists code text;
alter table public.discount_redemptions add column if not exists discount_amount numeric default 0;
alter table public.discount_redemptions add column if not exists created_at timestamp with time zone default now();

update public.discounts
set
  discount_type = coalesce(nullif(discount_type, ''), 'percentage'),
  discount_value = coalesce(discount_value, 0),
  promotion_type = coalesce(nullif(promotion_type, ''), case when nullif(code, '') is null then 'automatic_discount' else 'coupon_code' end),
  applies_to = coalesce(nullif(applies_to, ''), 'all'),
  product_ids = coalesce(product_ids, '{}'::uuid[]),
  category_ids = coalesce(category_ids, '{}'::uuid[]),
  category_slugs = coalesce(category_slugs, '{}'::text[]),
  collection_ids = coalesce(collection_ids, '{}'::uuid[]),
  tags = coalesce(tags, '{}'::text[]),
  minimum_order_amount = coalesce(minimum_order_amount, 0),
  used_count = coalesce(used_count, 0),
  usage_limit_per_customer = coalesce(usage_limit_per_customer, 1),
  starts_at = coalesce(starts_at, now()),
  is_active = coalesce(is_active, true),
  is_first_order_only = coalesce(is_first_order_only, false),
  buy_quantity = greatest(coalesce(buy_quantity, 1), 1),
  get_quantity = greatest(coalesce(get_quantity, 1), 1),
  combine_with_other_discounts = coalesce(combine_with_other_discounts, false),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where true;

create unique index if not exists discounts_code_upper_unique_idx
on public.discounts (upper(code))
where code is not null and btrim(code) <> '';

create index if not exists discounts_active_window_idx
on public.discounts (is_active, starts_at, expires_at);

create index if not exists discounts_category_slugs_gin_idx
on public.discounts using gin(category_slugs);

create index if not exists discounts_product_ids_gin_idx
on public.discounts using gin(product_ids);

create index if not exists discount_redemptions_discount_idx
on public.discount_redemptions(discount_id, created_at desc);

create index if not exists discount_redemptions_customer_idx
on public.discount_redemptions(auth_user_id, lower(customer_email));

create unique index if not exists discount_redemptions_unique_order_discount_idx
on public.discount_redemptions(order_id, discount_id)
where order_id is not null and discount_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'discounts_discount_type_check'
      and conrelid = 'public.discounts'::regclass
  ) then
    alter table public.discounts
    add constraint discounts_discount_type_check
    check (discount_type in ('percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'discounts_promotion_type_check'
      and conrelid = 'public.discounts'::regclass
  ) then
    alter table public.discounts
    add constraint discounts_promotion_type_check
    check (promotion_type in ('coupon', 'coupon_code', 'automatic_discount', 'category_offer', 'combo_offer', 'first_order_offer', 'free_shipping', 'buy_x_get_y')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'discounts_applies_to_check'
      and conrelid = 'public.discounts'::regclass
  ) then
    alter table public.discounts
    add constraint discounts_applies_to_check
    check (applies_to in ('all', 'order', 'all_products', 'category', 'categories', 'specific_categories', 'product', 'products', 'specific_products', 'collection', 'collections', 'specific_collections', 'tag', 'tags')) not valid;
  end if;
end $$;

create or replace function public.promotion_admin_allowed()
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
          and admin.role in (''admin'', ''manager'')
      )'
    into allowed
    using auth.uid();
  end if;

  return coalesce(allowed, false);
end;
$$;

create or replace function public.promotion_slug(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.discount_cart_item_number(cart_item jsonb, field_name text, fallback numeric default 0)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(cart_item ->> field_name, '') ~ '^-?[0-9]+(\.[0-9]+)?$' then (cart_item ->> field_name)::numeric
    else fallback
  end;
$$;

create or replace function public.discount_cart_item_matches(discount_row public.discounts, cart_item jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  scope text := lower(coalesce(discount_row.applies_to, 'all'));
  item_product_id text := coalesce(cart_item ->> 'product_id', cart_item ->> 'productId', cart_item ->> 'id');
  item_category_id text := coalesce(cart_item ->> 'category_id', cart_item ->> 'categoryId');
  item_category_slug text := coalesce(cart_item ->> 'category_slug', cart_item ->> 'categorySlug', cart_item ->> 'category');
  item_collections jsonb := coalesce(cart_item -> 'collection_ids', cart_item -> 'collectionIds', '[]'::jsonb);
  item_tags jsonb := coalesce(cart_item -> 'tags', '[]'::jsonb);
  target_uuid uuid;
  target_text text;
  item_text text;
begin
  if scope in ('all', 'order', 'all_products') then
    return true;
  end if;

  if scope in ('product', 'products', 'specific_products') then
    foreach target_uuid in array coalesce(discount_row.product_ids, '{}'::uuid[]) loop
      if target_uuid::text = item_product_id then
        return true;
      end if;
    end loop;
    return false;
  end if;

  if scope in ('category', 'categories', 'specific_categories') then
    foreach target_uuid in array coalesce(discount_row.category_ids, '{}'::uuid[]) loop
      if target_uuid::text = item_category_id then
        return true;
      end if;
    end loop;

    foreach target_text in array coalesce(discount_row.category_slugs, '{}'::text[]) loop
      if public.promotion_slug(target_text) = public.promotion_slug(item_category_slug) then
        return true;
      end if;
    end loop;

    return false;
  end if;

  if scope in ('collection', 'collections', 'specific_collections') then
    if jsonb_typeof(item_collections) = 'array' then
      foreach target_uuid in array coalesce(discount_row.collection_ids, '{}'::uuid[]) loop
        for item_text in select jsonb_array_elements_text(item_collections) loop
          if target_uuid::text = item_text then
            return true;
          end if;
        end loop;
      end loop;
    end if;
    return false;
  end if;

  if scope in ('tag', 'tags') then
    if jsonb_typeof(item_tags) = 'array' then
      foreach target_text in array coalesce(discount_row.tags, '{}'::text[]) loop
        for item_text in select jsonb_array_elements_text(item_tags) loop
          if public.promotion_slug(target_text) = public.promotion_slug(item_text) then
            return true;
          end if;
        end loop;
      end loop;
    elsif jsonb_typeof(item_tags) = 'string' then
      foreach target_text in array coalesce(discount_row.tags, '{}'::text[]) loop
        if public.promotion_slug(target_text) = public.promotion_slug(item_tags #>> '{}') then
          return true;
        end if;
      end loop;
    end if;
    return false;
  end if;

  return false;
end;
$$;

create or replace function public.discount_buy_x_get_y_amount(discount_row public.discounts, cart_items jsonb)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  eligible_quantity integer := 0;
  discounted_units integer := 0;
  set_size integer := greatest(coalesce(discount_row.buy_quantity, 1), 1) + greatest(coalesce(discount_row.get_quantity, 1), 1);
  amount numeric := 0;
begin
  select coalesce(sum(public.discount_cart_item_number(item, 'quantity', 0))::integer, 0)
  into eligible_quantity
  from jsonb_array_elements(coalesce(cart_items, '[]'::jsonb)) item
  where public.discount_cart_item_matches(discount_row, item);

  discounted_units := floor(eligible_quantity::numeric / greatest(set_size, 1))::integer * greatest(coalesce(discount_row.get_quantity, 1), 1);

  if discounted_units <= 0 then
    return 0;
  end if;

  select coalesce(sum(unit_price), 0)
  into amount
  from (
    select public.discount_cart_item_number(item, 'price', 0) as unit_price
    from jsonb_array_elements(coalesce(cart_items, '[]'::jsonb)) item
    cross join lateral generate_series(1, greatest(public.discount_cart_item_number(item, 'quantity', 0)::integer, 0)) unit_number
    where public.discount_cart_item_matches(discount_row, item)
    order by public.discount_cart_item_number(item, 'price', 0) asc
    limit discounted_units
  ) discounted_units_table;

  return greatest(coalesce(amount, 0), 0);
end;
$$;

create or replace function public.validate_discount(
  coupon_code text,
  cart_items jsonb,
  order_subtotal numeric,
  auth_user_id uuid default null,
  customer_email text default null
)
returns table (
  is_valid boolean,
  discount_id uuid,
  discount_amount numeric,
  message text,
  discount_code text,
  title text,
  discount_type text,
  promotion_type text,
  applies_to text,
  eligible_subtotal numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(btrim(coalesce($1, '')));
  cart jsonb := case when jsonb_typeof(coalesce($2, '[]'::jsonb)) = 'array' then coalesce($2, '[]'::jsonb) else '[]'::jsonb end;
  subtotal numeric := greatest(coalesce($3, 0), 0);
  request_auth_user_id uuid := $4;
  request_customer_email text := lower(btrim(coalesce($5, '')));
  candidate public.discounts%rowtype;
  candidate_seen boolean := false;
  candidate_valid boolean := false;
  candidate_amount numeric := 0;
  candidate_subtotal numeric := 0;
  candidate_quantity integer := 0;
  best_amount numeric := -1;
  best_subtotal numeric := 0;
  best_rule public.discounts%rowtype;
  last_message text := '';
  per_customer_count integer := 0;
  previous_order_exists boolean := false;
begin
  if subtotal <= 0 or jsonb_array_length(cart) = 0 then
    return query select false, null::uuid, 0::numeric, 'Add products before applying a promotion.', null::text, null::text, null::text, null::text, null::text, 0::numeric;
    return;
  end if;

  for candidate in
    select *
    from public.discounts d
    where case
      when normalized_code <> '' then upper(btrim(coalesce(d.code, ''))) = normalized_code
      else (
        coalesce(d.promotion_type, '') in ('automatic_discount', 'category_offer', 'combo_offer', 'first_order_offer', 'free_shipping', 'buy_x_get_y')
        or (coalesce(d.code, '') = '' and coalesce(d.promotion_type, '') <> 'coupon_code')
      )
    end
    order by d.created_at desc nulls last
  loop
    candidate_seen := true;
    candidate_valid := true;
    candidate_amount := 0;
    candidate_subtotal := 0;
    candidate_quantity := 0;
    last_message := '';

    if candidate.is_active is not true then
      candidate_valid := false;
      last_message := 'This promotion is inactive.';
    elsif candidate.starts_at is not null and candidate.starts_at > now() then
      candidate_valid := false;
      last_message := 'This promotion has not started yet.';
    elsif candidate.expires_at is not null and candidate.expires_at < now() then
      candidate_valid := false;
      last_message := 'This promotion has expired.';
    elsif candidate.usage_limit is not null and coalesce(candidate.used_count, 0) >= candidate.usage_limit then
      candidate_valid := false;
      last_message := 'This promotion has reached its usage limit.';
    elsif subtotal < coalesce(candidate.minimum_order_amount, 0) then
      candidate_valid := false;
      last_message := 'Minimum order amount for this promotion is not met.';
    end if;

    if candidate_valid and coalesce(candidate.usage_limit_per_customer, 0) > 0 and (request_auth_user_id is not null or request_customer_email <> '') then
      select count(*)
      into per_customer_count
      from public.discount_redemptions redemption
      where redemption.discount_id = candidate.id
        and (
          (request_auth_user_id is not null and redemption.auth_user_id = request_auth_user_id)
          or (request_customer_email <> '' and lower(coalesce(redemption.customer_email, '')) = request_customer_email)
        );

      if per_customer_count >= candidate.usage_limit_per_customer then
        candidate_valid := false;
        last_message := 'This promotion has already been used by this customer.';
      end if;
    end if;

    if candidate_valid and candidate.is_first_order_only is true then
      if request_auth_user_id is null and request_customer_email = '' then
        candidate_valid := false;
        last_message := 'Sign in or enter your email to use this first-order offer.';
      else
        select exists(
          select 1
          from public.orders order_row
          where (
            (request_auth_user_id is not null and order_row.auth_user_id = request_auth_user_id)
            or (request_customer_email <> '' and lower(coalesce(order_row.customer_email, '')) = request_customer_email)
          )
          and lower(coalesce(order_row.status, '')) not in ('cancelled', 'canceled', 'refunded', 'returned', 'failed')
        )
        into previous_order_exists;

        if previous_order_exists then
          candidate_valid := false;
          last_message := 'This offer is valid only on your first order.';
        end if;
      end if;
    end if;

    if candidate_valid then
      select
        coalesce(sum(public.discount_cart_item_number(item, 'price', 0) * public.discount_cart_item_number(item, 'quantity', 0)), 0),
        coalesce(sum(public.discount_cart_item_number(item, 'quantity', 0))::integer, 0)
      into candidate_subtotal, candidate_quantity
      from jsonb_array_elements(cart) item
      where public.discount_cart_item_matches(candidate, item);

      if candidate_subtotal <= 0 then
        candidate_valid := false;
        last_message := 'This promotion applies to eligible items only.';
      end if;
    end if;

    if candidate_valid then
      if candidate.discount_type = 'percentage' then
        candidate_amount := candidate_subtotal * (greatest(coalesce(candidate.discount_value, 0), 0) / 100);
      elsif candidate.discount_type = 'fixed_amount' then
        candidate_amount := least(greatest(coalesce(candidate.discount_value, 0), 0), candidate_subtotal);
      elsif candidate.discount_type = 'buy_x_get_y' then
        candidate_amount := public.discount_buy_x_get_y_amount(candidate, cart);
        if candidate_amount <= 0 then
          candidate_valid := false;
          last_message := 'Add the required quantity to unlock this combo offer.';
        end if;
      elsif candidate.discount_type = 'free_shipping' then
        candidate_amount := 0;
      else
        candidate_valid := false;
        last_message := 'Unsupported promotion type.';
      end if;
    end if;

    if candidate_valid then
      if candidate.maximum_discount_amount is not null and candidate.maximum_discount_amount > 0 then
        candidate_amount := least(candidate_amount, candidate.maximum_discount_amount);
      end if;

      candidate_amount := round(greatest(least(candidate_amount, candidate_subtotal), 0), 2);

      if normalized_code <> '' or candidate_amount >= best_amount then
        best_amount := candidate_amount;
        best_subtotal := candidate_subtotal;
        best_rule := candidate;
      end if;

      if normalized_code <> '' then
        exit;
      end if;
    end if;
  end loop;

  if best_amount >= 0 and best_rule.id is not null then
    return query select
      true,
      best_rule.id,
      best_amount,
      case
        when best_rule.discount_type = 'free_shipping' then 'Free shipping promotion applied.'
        when best_rule.applies_to in ('category', 'categories', 'specific_categories') then 'Coupon applied to eligible category items only.'
        else 'Promotion applied successfully.'
      end,
      best_rule.code,
      best_rule.title,
      best_rule.discount_type,
      best_rule.promotion_type,
      best_rule.applies_to,
      best_subtotal;
    return;
  end if;

  if not candidate_seen then
    return query select false, null::uuid, 0::numeric, case when normalized_code <> '' then 'Coupon code not found.' else 'No automatic promotion applies.' end, null::text, null::text, null::text, null::text, null::text, 0::numeric;
    return;
  end if;

  return query select false, null::uuid, 0::numeric, coalesce(nullif(last_message, ''), 'This promotion is not eligible for the current cart.'), null::text, null::text, null::text, null::text, null::text, 0::numeric;
end;
$$;

create or replace function public.finalize_discount_redemption(
  coupon_code text,
  cart_items jsonb,
  order_subtotal numeric,
  order_id uuid,
  auth_user_id uuid default null,
  customer_email text default null
)
returns table (
  is_valid boolean,
  discount_id uuid,
  discount_amount numeric,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  validation record;
  locked_discount public.discounts%rowtype;
  inserted_count integer := 0;
begin
  select *
  into validation
  from public.validate_discount($1, $2, $3, $5, $6)
  limit 1;

  if validation.is_valid is not true or validation.discount_id is null then
    return query select false, null::uuid, 0::numeric, coalesce(validation.message, 'Promotion could not be finalized.');
    return;
  end if;

  select *
  into locked_discount
  from public.discounts d
  where d.id = validation.discount_id
  for update;

  if locked_discount.usage_limit is not null and coalesce(locked_discount.used_count, 0) >= locked_discount.usage_limit then
    return query select false, locked_discount.id, 0::numeric, 'This promotion has reached its usage limit.';
    return;
  end if;

  with inserted as (
    insert into public.discount_redemptions (
      discount_id,
      order_id,
      auth_user_id,
      customer_email,
      code,
      discount_amount
    )
    values (
      validation.discount_id,
      $4,
      $5,
      nullif(lower(btrim(coalesce($6, ''))), ''),
      validation.discount_code,
      validation.discount_amount
    )
    on conflict do nothing
    returning id
  )
  select count(*) into inserted_count from inserted;

  if inserted_count > 0 then
    update public.discounts
    set used_count = coalesce(used_count, 0) + 1,
        updated_at = now()
    where id = validation.discount_id;
  end if;

  update public.orders
  set coupon_code = coalesce(validation.discount_code, nullif(upper(btrim(coalesce($1, ''))), '')),
      discount_id = validation.discount_id,
      discount_amount = validation.discount_amount,
      promotion_title = validation.title
  where id = $4;

  return query select true, validation.discount_id, validation.discount_amount, 'Promotion redemption recorded.';
end;
$$;

alter table public.discounts enable row level security;
alter table public.discount_redemptions enable row level security;

drop policy if exists "Public can read active promotions" on public.discounts;
create policy "Public can read active promotions"
on public.discounts
for select
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (expires_at is null or expires_at >= now())
);

drop policy if exists "Admins can manage promotions" on public.discounts;
create policy "Admins can manage promotions"
on public.discounts
for all
using (public.promotion_admin_allowed())
with check (public.promotion_admin_allowed());

drop policy if exists "Admins can manage discount redemptions" on public.discount_redemptions;
create policy "Admins can manage discount redemptions"
on public.discount_redemptions
for all
using (public.promotion_admin_allowed())
with check (public.promotion_admin_allowed());

drop policy if exists "Customers can read their discount redemptions" on public.discount_redemptions;
create policy "Customers can read their discount redemptions"
on public.discount_redemptions
for select
using (auth_user_id = auth.uid());

grant select on public.discounts to anon, authenticated;
grant select on public.discount_redemptions to authenticated;
grant execute on function public.validate_discount(text, jsonb, numeric, uuid, text) to anon, authenticated;
grant execute on function public.finalize_discount_redemption(text, jsonb, numeric, uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ===== END supabase-promotions-safe.sql =====


-- ===== BEGIN supabase-analytics-dashboard-safe.sql =====

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

-- ===== END supabase-analytics-dashboard-safe.sql =====


-- ===== BEGIN supabase-seo-safe.sql =====

-- Radios ecommerce SEO system.
-- Safe to run more than once. Adds slug/meta fields for products and categories,
-- normalizes existing slugs, grants admin update access, and refreshes PostgREST.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  description text,
  icon text,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text,
  name text,
  slug text,
  price numeric default 0,
  image_url text,
  image text,
  category text,
  category_slug text,
  stock integer default 0,
  visible boolean default true,
  is_active boolean default true,
  status text default 'active',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.products add column if not exists title text;
alter table public.products add column if not exists name text;
alter table public.products add column if not exists slug text;
alter table public.products add column if not exists meta_title text;
alter table public.products add column if not exists meta_description text;
alter table public.products add column if not exists canonical_url text;
alter table public.products add column if not exists og_image_url text;
alter table public.products add column if not exists visible boolean default true;
alter table public.products add column if not exists is_active boolean default true;
alter table public.products add column if not exists status text default 'active';
alter table public.products add column if not exists created_at timestamp with time zone default now();
alter table public.products add column if not exists updated_at timestamp with time zone default now();

alter table public.categories add column if not exists name text;
alter table public.categories add column if not exists description text;
alter table public.categories add column if not exists is_active boolean default true;
alter table public.categories add column if not exists sort_order integer default 0;
alter table public.categories add column if not exists created_at timestamp with time zone default now();
alter table public.categories add column if not exists slug text;
alter table public.categories add column if not exists meta_title text;
alter table public.categories add column if not exists meta_description text;
alter table public.categories add column if not exists canonical_url text;
alter table public.categories add column if not exists og_image_url text;
alter table public.categories add column if not exists updated_at timestamp with time zone default now();
alter table public.categories add column if not exists status text default 'active';
alter table public.categories add column if not exists visible boolean default true;

create or replace function public.radios_seo_slug(raw_value text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from lower(regexp_replace(regexp_replace(coalesce(raw_value, ''), '&', 'and', 'g'), '[^a-zA-Z0-9]+', '-', 'g'))),
    ''
  );
$$;

update public.products
set slug = public.radios_seo_slug(coalesce(nullif(slug, ''), title, name, id::text))
where slug is null or trim(slug) = '' or slug <> public.radios_seo_slug(slug);

update public.products
set slug = coalesce(slug, 'product-' || left(id::text, 8))
where slug is null or trim(slug) = '';

with ranked_products as (
  select
    id,
    slug,
    row_number() over (partition by slug order by id) as slug_rank
  from public.products
  where slug is not null and trim(slug) <> ''
)
update public.products product
set slug = left(ranked_products.slug, 190) || '-' || left(product.id::text, 8)
from ranked_products
where product.id = ranked_products.id
  and ranked_products.slug_rank > 1;

update public.categories
set slug = public.radios_seo_slug(coalesce(nullif(slug, ''), name, id::text))
where slug is null or trim(slug) = '' or slug <> public.radios_seo_slug(slug);

update public.categories
set slug = coalesce(slug, 'category-' || left(id::text, 8))
where slug is null or trim(slug) = '';

with ranked_categories as (
  select
    id,
    slug,
    row_number() over (partition by slug order by id) as slug_rank
  from public.categories
  where slug is not null and trim(slug) <> ''
)
update public.categories category
set slug = left(ranked_categories.slug, 190) || '-' || left(category.id::text, 8)
from ranked_categories
where category.id = ranked_categories.id
  and ranked_categories.slug_rank > 1;

create unique index if not exists products_slug_unique_idx
on public.products(slug)
where slug is not null and trim(slug) <> '';

create unique index if not exists categories_slug_unique_idx
on public.categories(slug)
where slug is not null and trim(slug) <> '';

create index if not exists products_seo_visible_idx
on public.products(visible, is_active, status, updated_at);

create index if not exists categories_seo_active_idx
on public.categories(is_active, sort_order);

create or replace function public.radios_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_seo_set_updated_at on public.products;
create trigger products_seo_set_updated_at
before update of slug, meta_title, meta_description, canonical_url, og_image_url
on public.products
for each row
execute function public.radios_set_updated_at();

drop trigger if exists categories_seo_set_updated_at on public.categories;
create trigger categories_seo_set_updated_at
before update of slug, meta_title, meta_description, canonical_url, og_image_url
on public.categories
for each row
execute function public.radios_set_updated_at();

create or replace function public.radios_catalog_admin_allowed()
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

  if to_regclass('public.admin_users') is null then
    return false;
  end if;

  execute
    'select exists (
      select 1
      from public.admin_users admin
      where admin.auth_user_id = $1
        and admin.is_active = true
        and admin.role in (''admin'', ''manager'')
    )'
  into allowed
  using auth.uid();

  return coalesce(allowed, false);
end;
$$;

drop policy if exists "Admins can update product SEO" on public.products;
create policy "Admins can update product SEO"
on public.products
for update
using (public.radios_catalog_admin_allowed())
with check (public.radios_catalog_admin_allowed());

drop policy if exists "Public can select SEO visible products" on public.products;
create policy "Public can select SEO visible products"
on public.products
for select
using (
  (coalesce(visible, false) = true or coalesce(is_active, false) = true)
  and lower(coalesce(status, 'active')) not in ('draft', 'hidden', 'archived', 'inactive', 'unpublished', 'disabled', 'deleted')
);

drop policy if exists "Admins can update category SEO" on public.categories;
create policy "Admins can update category SEO"
on public.categories
for update
using (public.radios_catalog_admin_allowed())
with check (public.radios_catalog_admin_allowed());

drop policy if exists "Public can select active categories" on public.categories;
create policy "Public can select active categories"
on public.categories
for select
using (
  coalesce(is_active, true) = true
  and lower(coalesce(status, 'active')) not in ('hidden', 'archived', 'inactive', 'disabled', 'deleted')
);

grant select on public.products to anon, authenticated;
grant select on public.categories to anon, authenticated;

grant update(slug, meta_title, meta_description, canonical_url, og_image_url)
on public.products to authenticated;

grant update(slug, meta_title, meta_description, canonical_url, og_image_url)
on public.categories to authenticated;

notify pgrst, 'reload schema';

-- ===== END supabase-seo-safe.sql =====


-- ===== BEGIN supabase-performance-safe.sql =====

-- Radios ecommerce performance indexes.
-- Safe to run more than once. These indexes support paginated storefront listings,
-- category/search filters, homepage banners, and Dashcode order/product tables.

alter table if exists public.products add column if not exists visible boolean default true;
alter table if exists public.products add column if not exists is_active boolean default true;
alter table if exists public.products add column if not exists status text default 'active';
alter table if exists public.products add column if not exists category_slug text;
alter table if exists public.products add column if not exists price numeric default 0;
alter table if exists public.products add column if not exists sales_count integer default 0;
alter table if exists public.products add column if not exists slug text;
alter table if exists public.products add column if not exists updated_at timestamp with time zone default now();

alter table if exists public.categories add column if not exists is_active boolean default true;
alter table if exists public.categories add column if not exists sort_order integer default 0;
alter table if exists public.categories add column if not exists name text;

do $$
begin
  if to_regclass('public.products') is not null then
    execute $sql$
      create index if not exists products_storefront_visible_updated_idx
      on public.products (updated_at desc)
      where (coalesce(visible, false) = true or coalesce(is_active, false) = true)
        and lower(coalesce(status, 'active')) not in ('draft', 'hidden', 'archived', 'inactive', 'unpublished', 'disabled', 'deleted')
    $sql$;

    execute $sql$
      create index if not exists products_storefront_category_updated_idx
      on public.products (category_slug, updated_at desc)
      where (coalesce(visible, false) = true or coalesce(is_active, false) = true)
        and lower(coalesce(status, 'active')) not in ('draft', 'hidden', 'archived', 'inactive', 'unpublished', 'disabled', 'deleted')
    $sql$;

    execute $sql$
      create index if not exists products_storefront_price_idx
      on public.products (price)
      where (coalesce(visible, false) = true or coalesce(is_active, false) = true)
        and lower(coalesce(status, 'active')) not in ('draft', 'hidden', 'archived', 'inactive', 'unpublished', 'disabled', 'deleted')
    $sql$;

    execute $sql$
      create index if not exists products_storefront_sales_idx
      on public.products (sales_count desc nulls last, updated_at desc)
      where (coalesce(visible, false) = true or coalesce(is_active, false) = true)
        and lower(coalesce(status, 'active')) not in ('draft', 'hidden', 'archived', 'inactive', 'unpublished', 'disabled', 'deleted')
    $sql$;

    execute $sql$
      create index if not exists products_storefront_slug_idx
      on public.products (slug)
      where slug is not null and trim(slug) <> ''
    $sql$;
  end if;

  if to_regclass('public.categories') is not null then
    execute $sql$
      create index if not exists categories_storefront_active_sort_idx
      on public.categories (is_active, sort_order, name)
    $sql$;
  end if;

  if to_regclass('public.homepage_banners') is not null then
    execute $sql$
      create index if not exists homepage_banners_active_section_sort_idx
      on public.homepage_banners (section_key, sort_order)
      where coalesce(is_active, true) = true
    $sql$;
  end if;

  if to_regclass('public.orders') is not null then
    execute 'create index if not exists orders_dashboard_created_idx on public.orders (created_at desc)';
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'orders' and column_name = 'status'
    ) then
      execute 'create index if not exists orders_dashboard_status_created_idx on public.orders (status, created_at desc)';
    end if;
  end if;

  if to_regclass('public.order_items') is not null then
    execute 'create index if not exists order_items_order_product_idx on public.order_items (order_id, product_id)';
  end if;
end $$;

notify pgrst, 'reload schema';

-- ===== END supabase-performance-safe.sql =====

