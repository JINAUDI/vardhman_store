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
