-- Vardhman Store production product detail fields.
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
