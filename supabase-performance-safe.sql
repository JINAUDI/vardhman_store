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
