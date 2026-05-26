create extension if not exists "pgcrypto";

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

create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  title text,
  code text not null unique,
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
  eligibility text default 'all_customers',
  eligible_customer_ids text[] default '{}'::text[],
  eligible_customer_segments text[] default '{}'::text[],
  applies_to text default 'all',
  selected_product_ids text[] default '{}'::text[],
  buy_quantity integer default 0,
  get_quantity integer default 0,
  buy_target_scope text default 'all_products',
  buy_product_ids text[] default '{}'::text[],
  buy_collection_ids text[] default '{}'::text[],
  buy_category_slugs text[] default '{}'::text[],
  get_target_scope text default 'all_products',
  get_product_ids text[] default '{}'::text[],
  get_collection_ids text[] default '{}'::text[],
  get_category_slugs text[] default '{}'::text[],
  maximum_uses_per_order integer default 0,
  combines_with_product_discounts boolean default false,
  combines_with_order_discounts boolean default false,
  combines_with_shipping_discounts boolean default false,
  sales_channels text[] default array['Online Store']::text[],
  tags text[] default '{}'::text[],
  regions text[] default '{}'::text[],
  auto_generated boolean default false,
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
  order_number text not null unique,
  tracking_id text not null unique,
  tracking_status text default 'Order Placed',
  tracking_updated_at timestamp with time zone default now(),
  estimated_delivery_date date,
  customer_id uuid references public.customers(id) on delete set null,
  auth_user_id uuid,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  delivery_address text,
  city text,
  state text,
  pincode text,
  country text default 'India',
  payment_method text default 'cod',
  delivery_method text default 'standard',
  subtotal numeric(12,2) default 0,
  discount numeric(12,2) default 0,
  delivery_charge numeric(12,2) default 0,
  total numeric(12,2) default 0,
  status text default 'pending',
  payment_status text default 'unpaid',
  shipping_status text default 'not_shipped',
  coupon_code text,
  courier text,
  estimated_delivery timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text,
  product_name text not null,
  product_image text,
  quantity integer not null default 1,
  price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
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
  total numeric(12,2),
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

alter table public.discounts
  alter column code drop not null;

alter table public.discounts
  add column if not exists title text,
  add column if not exists method text not null default 'code',
  add column if not exists value_type text not null default 'percentage',
  add column if not exists discount_category text not null default 'product_discount',
  add column if not exists target_scope text default 'all_products',
  add column if not exists target_product_ids text[] default '{}'::text[],
  add column if not exists target_collection_ids text[] default '{}'::text[],
  add column if not exists target_category_slugs text[] default '{}'::text[],
  add column if not exists requirement_type text default 'none',
  add column if not exists once_per_customer boolean default false,
  add column if not exists starts_at timestamp with time zone default now(),
  add column if not exists ends_at timestamp with time zone,
  add column if not exists eligibility text default 'all_customers',
  add column if not exists eligible_customer_ids text[] default '{}'::text[],
  add column if not exists eligible_customer_segments text[] default '{}'::text[],
  add column if not exists applies_to text default 'all',
  add column if not exists selected_product_ids text[] default '{}'::text[],
  add column if not exists buy_quantity integer default 0,
  add column if not exists get_quantity integer default 0,
  add column if not exists buy_target_scope text default 'all_products',
  add column if not exists buy_product_ids text[] default '{}'::text[],
  add column if not exists buy_collection_ids text[] default '{}'::text[],
  add column if not exists buy_category_slugs text[] default '{}'::text[],
  add column if not exists get_target_scope text default 'all_products',
  add column if not exists get_product_ids text[] default '{}'::text[],
  add column if not exists get_collection_ids text[] default '{}'::text[],
  add column if not exists get_category_slugs text[] default '{}'::text[],
  add column if not exists maximum_uses_per_order integer default 0,
  add column if not exists combines_with_product_discounts boolean default false,
  add column if not exists combines_with_order_discounts boolean default false,
  add column if not exists combines_with_shipping_discounts boolean default false,
  add column if not exists sales_channels text[] default array['Online Store']::text[],
  add column if not exists tags text[] default '{}'::text[],
  add column if not exists regions text[] default '{}'::text[],
  add column if not exists auto_generated boolean default false,
  add column if not exists updated_at timestamp with time zone default now();

alter table public.homepage_banners
  add column if not exists section_key text default 'hero';

alter table public.customers
  add column if not exists auth_user_id uuid unique,
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists is_active boolean default true,
  add column if not exists updated_at timestamp with time zone default now();

alter table public.admin_users
  add column if not exists auth_user_id uuid unique,
  add column if not exists email text unique,
  add column if not exists role text default 'admin',
  add column if not exists is_active boolean default true;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'customer_id'
      and data_type <> 'uuid'
  ) then
    alter table public.orders rename column customer_id to legacy_customer_id;
  end if;
end $$;

alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists auth_user_id uuid,
  add column if not exists tracking_status text default 'Order Placed',
  add column if not exists tracking_updated_at timestamp with time zone default now(),
  add column if not exists estimated_delivery_date date,
  add column if not exists payment_status text default 'unpaid',
  add column if not exists shipping_status text default 'not_shipped',
  add column if not exists courier text,
  add column if not exists estimated_delivery timestamp with time zone,
  add column if not exists updated_at timestamp with time zone default now();

alter table public.products
  add column if not exists title text,
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists sku text,
  add column if not exists description text,
  add column if not exists price numeric(12,2) default 0,
  add column if not exists compare_at_price numeric(12,2),
  add column if not exists image text,
  add column if not exists image_url text,
  add column if not exists images text[] default '{}'::text[],
  add column if not exists category text,
  add column if not exists category_slug text,
  add column if not exists stock integer default 0,
  add column if not exists low_stock_threshold integer default 10,
  add column if not exists visible boolean default true,
  add column if not exists is_active boolean default true,
  add column if not exists status text default 'active',
  add column if not exists featured boolean default false,
  add column if not exists tags text[] default '{}'::text[],
  add column if not exists meta_title text,
  add column if not exists meta_description text,
  add column if not exists updated_at timestamp with time zone default now();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.homepage_banners enable row level security;
alter table public.collections enable row level security;
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

drop policy if exists "Allow public select active homepage banners" on public.homepage_banners;
create policy "Allow public select active homepage banners"
  on public.homepage_banners
  for select
  using (is_active = true);

drop policy if exists "Allow public select active collections" on public.collections;
create policy "Allow public select active collections"
  on public.collections
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

drop policy if exists "Allow public create orders" on public.orders;
create policy "Allow public create orders"
  on public.orders
  for insert
  with check (true);

drop policy if exists "Customers read own orders" on public.orders;
create policy "Customers read own orders"
  on public.orders
  for select
  using (
    auth.uid() = auth_user_id
    or lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "Allow public create order items" on public.order_items;
create policy "Allow public create order items"
  on public.order_items
  for insert
  with check (true);

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

drop policy if exists "Allow service role manage categories" on public.categories;
create policy "Allow service role manage categories"
  on public.categories
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage products" on public.products;
create policy "Allow service role manage products"
  on public.products
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage homepage banners" on public.homepage_banners;
create policy "Allow service role manage homepage banners"
  on public.homepage_banners
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage collections" on public.collections;
create policy "Allow service role manage collections"
  on public.collections
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage discounts" on public.discounts;
create policy "Allow service role manage discounts"
  on public.discounts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage customers" on public.customers;
create policy "Allow service role manage customers"
  on public.customers
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Allow service role manage admin users" on public.admin_users;
create policy "Allow service role manage admin users"
  on public.admin_users
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Allow active admin read own admin user" on public.admin_users;
create policy "Allow active admin read own admin user"
  on public.admin_users
  for select
  to authenticated
  using (auth.uid() = auth_user_id and is_active = true);

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
grant select on public.categories, public.products, public.homepage_banners, public.collections, public.discounts, public.reviews to anon, authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert on public.orders to anon, authenticated;
grant select, insert on public.order_items to anon, authenticated;
grant select, insert, update on public.notifications to anon, authenticated;
grant select, insert on public.wishlist to authenticated;
grant insert on public.analytics_events to anon, authenticated;

notify pgrst, 'reload schema';

insert into public.categories (name, slug, icon, description, sort_order)
values
  ('Electronics', 'electronics', 'fas fa-laptop', 'Wifi cameras, keyboards, speakers, and everyday electronics.', 1),
  ('Mobile Accessories', 'mobile-accessories', 'fas fa-headphones', 'Chargers, earbuds, headphones, stands, and mobile essentials.', 2),
  ('Health Supplements', 'health-supplements', 'fas fa-capsules', 'Powders, tablets, liquids, and health support essentials.', 3),
  ('Hygiene & Personal Care', 'hygiene-personal-care', 'fas fa-heart', 'Personal care, grooming, skincare, and hygiene products.', 4),
  ('Baby Products', 'baby-products', 'fas fa-baby', 'Gentle baby care products and daily essentials.', 5),
  ('Household Items', 'household-items', 'fas fa-home', 'Useful household, home care, and utility items.', 6)
on conflict (slug) do update
set
  name = excluded.name,
  icon = excluded.icon,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.homepage_banners (title, subtitle, button_text, button_link, image_url, category_id, section_key, banner_type, sort_order)
select seed.title, seed.subtitle, seed.button_text, seed.button_link, seed.image_url, categories.id, seed.section_key, seed.section_key, seed.sort_order
from (
  values
    ('Electronics', 'Wifi Camera / Mouse / Keyboard / OTG', 'Shop Now', 'category.html?slug=electronics', 'assets/images/hero/electronics.jpg', 'electronics', 'hero', 1),
    ('Mobile Accessories', 'Chargers / Earbuds / Headphones and More', 'Shop Now', 'category.html?slug=mobile-accessories', 'assets/images/hero/mobile-accessories.jpg', 'mobile-accessories', 'hero', 2),
    ('Health Supplements', 'Powders / Liquids / Tablets and More', 'Shop Now', 'category.html?slug=health-supplements', 'assets/images/hero/health-supplements.jpg', 'health-supplements', 'hero', 3),
    ('Hygiene & Personal Care', 'Shampoo / Trimmer / Skincare and More', 'Shop Now', 'category.html?slug=hygiene-personal-care', 'assets/images/hero/hygiene.jpg', 'hygiene-personal-care', 'hero', 4),
    ('Baby Products', 'Baby Oil / Lotion / Wipes and More', 'Shop Now', 'category.html?slug=baby-products', 'assets/images/hero/baby-products-new.png', 'baby-products', 'hero', 5),
    ('Category Promo', 'Featured collections for every need', 'Shop Now', 'shop-left-sidebar.html', 'assets/img/bg/bg_02.jpg', null, 'category_promo', 1),
    ('Mid Page Offer', 'Exclusive storewide offers', 'Buy Now', 'shop-left-sidebar.html', 'assets/img/bg/bg_01.jpg', null, 'mid_offer', 1),
    ('Deals & Offers', 'Limited time savings', 'Shop Now', 'shop-left-sidebar.html', 'assets/img/bg/bg_03.jpg', null, 'deals', 1),
    ('Trending Products', 'Best seller picks this week', 'Shop Now', 'shop-left-sidebar.html', 'assets/img/bg/bg_05.jpg', null, 'trending', 1),
    ('Bottom Promotion', 'Discover more Radios deals', 'Shop Now', 'shop-left-sidebar.html', 'assets/img/bg/bg_05.jpg', null, 'bottom_promo', 1)
) as seed(title, subtitle, button_text, button_link, image_url, category_slug, section_key, sort_order)
left join public.categories on categories.slug = seed.category_slug
where (seed.category_slug is null or categories.id is not null)
  and not exists (
    select 1
    from public.homepage_banners existing
    where existing.title = seed.title
      and existing.section_key = seed.section_key
  );

insert into public.collections (
  title,
  slug,
  description,
  image_url,
  collection_type,
  is_active,
  sales_channels,
  theme_template,
  sort_order,
  sort_type,
  conditions_match,
  conditions,
  product_ids,
  tags
)
values
  (
    'Featured Collection',
    'featured-collection',
    'Products manually highlighted by the admin team.',
    null,
    'manual',
    true,
    array['Online Store']::text[],
    'default-collection',
    1,
    'manual',
    'all',
    '[]'::jsonb,
    '{}'::text[],
    array['featured']::text[]
  ),
  (
    'Budget Buys Under 500',
    'budget-buys-under-500',
    'Smart collection for products priced below 500.',
    null,
    'smart',
    true,
    array['Online Store']::text[],
    'default-collection',
    2,
    'price_asc',
    'all',
    '[{"id":"seed-price-under-500","field":"price","operator":"less_than","value":"500"}]'::jsonb,
    '{}'::text[],
    array['budget']::text[]
  )
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  collection_type = excluded.collection_type,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  sort_type = excluded.sort_type,
  conditions_match = excluded.conditions_match,
  conditions = excluded.conditions,
  tags = excluded.tags;

insert into public.discounts (
  title,
  code,
  method,
  type,
  value_type,
  discount_category,
  value,
  target_scope,
  target_collection_ids,
  min_order_amount,
  requirement_type,
  usage_limit,
  used_count,
  starts_at,
  status,
  combines_with_shipping_discounts,
  sales_channels,
  tags
)
values
  (
    'Welcome 10',
    'WELCOME10',
    'code',
    'percentage',
    'percentage',
    'order_discount',
    10,
    'all_products',
    '{}'::text[],
    0,
    'none',
    1000,
    0,
    now(),
    'active',
    false,
    array['Online Store']::text[],
    array['welcome']::text[]
  )
on conflict (code) do update
set
  title = excluded.title,
  value = excluded.value,
  status = excluded.status,
  updated_at = now();
