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
