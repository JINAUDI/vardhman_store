create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
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
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.categories add column if not exists slug text;
alter table public.categories add column if not exists description text;
alter table public.categories add column if not exists icon text;
alter table public.categories add column if not exists is_active boolean default true;
alter table public.categories add column if not exists sort_order integer default 0;

alter table public.products add column if not exists category_slug text;

update public.categories
set slug = lower(regexp_replace(regexp_replace(name, '&', 'and', 'g'), '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null and name is not null;

update public.products
set category_slug = lower(regexp_replace(regexp_replace(category, '&', 'and', 'g'), '[^a-zA-Z0-9]+', '-', 'g'))
where category_slug is null and category is not null;

create unique index if not exists categories_slug_unique on public.categories (slug);

notify pgrst, 'reload schema';
