-- Supabase Storage setup for Vardhman Store storefront images.
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
