-- Vardhman Store ecommerce SEO system.
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
