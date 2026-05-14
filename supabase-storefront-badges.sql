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
