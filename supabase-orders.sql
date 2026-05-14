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
