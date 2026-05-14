-- Radios customer account area.
-- Safe to run multiple times. Does not drop or delete existing data.

create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text,
  email text unique,
  phone text,
  avatar_url text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.customers add column if not exists auth_user_id uuid unique;
alter table public.customers add column if not exists full_name text;
alter table public.customers add column if not exists email text;
alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists avatar_url text;
alter table public.customers add column if not exists is_active boolean default true;
alter table public.customers add column if not exists created_at timestamp with time zone default now();
alter table public.customers add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  email text unique not null,
  role text default 'admin',
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

alter table public.admin_users add column if not exists auth_user_id uuid unique;
alter table public.admin_users add column if not exists email text;
alter table public.admin_users add column if not exists role text default 'admin';
alter table public.admin_users add column if not exists is_active boolean default true;
alter table public.admin_users add column if not exists created_at timestamp with time zone default now();

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  customer_id uuid references public.customers(id) on delete cascade,
  full_name text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  country text default 'India',
  address_type text default 'home',
  is_default boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.customer_addresses add column if not exists auth_user_id uuid;
alter table public.customer_addresses add column if not exists customer_id uuid;
alter table public.customer_addresses add column if not exists full_name text;
alter table public.customer_addresses add column if not exists phone text;
alter table public.customer_addresses add column if not exists address_line1 text;
alter table public.customer_addresses add column if not exists address_line2 text;
alter table public.customer_addresses add column if not exists city text;
alter table public.customer_addresses add column if not exists state text;
alter table public.customer_addresses add column if not exists pincode text;
alter table public.customer_addresses add column if not exists country text default 'India';
alter table public.customer_addresses add column if not exists address_type text default 'home';
alter table public.customer_addresses add column if not exists is_default boolean default false;
alter table public.customer_addresses add column if not exists created_at timestamp with time zone default now();
alter table public.customer_addresses add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  auth_user_id uuid,
  customer_name text,
  customer_email text,
  reason text,
  status text default 'requested',
  admin_note text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.return_requests add column if not exists order_id uuid;
alter table public.return_requests add column if not exists auth_user_id uuid;
alter table public.return_requests add column if not exists customer_name text;
alter table public.return_requests add column if not exists customer_email text;
alter table public.return_requests add column if not exists reason text;
alter table public.return_requests add column if not exists status text default 'requested';
alter table public.return_requests add column if not exists admin_note text;
alter table public.return_requests add column if not exists created_at timestamp with time zone default now();
alter table public.return_requests add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  title text not null,
  message text,
  type text default 'account',
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

alter table public.customer_notifications add column if not exists auth_user_id uuid;
alter table public.customer_notifications add column if not exists title text;
alter table public.customer_notifications add column if not exists message text;
alter table public.customer_notifications add column if not exists type text default 'account';
alter table public.customer_notifications add column if not exists is_read boolean default false;
alter table public.customer_notifications add column if not exists created_at timestamp with time zone default now();

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  order_id uuid,
  product_id uuid,
  rating integer,
  title text,
  comment text,
  status text default 'pending',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.reviews add column if not exists auth_user_id uuid;
alter table public.reviews add column if not exists order_id uuid;
alter table public.reviews add column if not exists product_id uuid;
alter table public.reviews add column if not exists rating integer;
alter table public.reviews add column if not exists title text;
alter table public.reviews add column if not exists comment text;
alter table public.reviews add column if not exists status text default 'pending';
alter table public.reviews add column if not exists created_at timestamp with time zone default now();
alter table public.reviews add column if not exists updated_at timestamp with time zone default now();

alter table public.orders add column if not exists auth_user_id uuid;
alter table public.orders add column if not exists customer_id uuid;
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists tracking_id text;
alter table public.orders add column if not exists payment_status text;

create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid,
  auth_user_id uuid,
  session_id text,
  product_id uuid references public.products(id) on delete cascade,
  created_at timestamp with time zone default now()
);

alter table public.wishlist add column if not exists auth_user_id uuid;
alter table public.wishlist add column if not exists customer_id uuid;
alter table public.wishlist add column if not exists session_id text;

create index if not exists customers_auth_user_id_idx on public.customers (auth_user_id);
create index if not exists customers_email_idx on public.customers (email);
create index if not exists customer_addresses_auth_user_id_idx on public.customer_addresses (auth_user_id);
create index if not exists customer_addresses_customer_id_idx on public.customer_addresses (customer_id);
create index if not exists return_requests_auth_user_id_idx on public.return_requests (auth_user_id);
create index if not exists return_requests_order_id_idx on public.return_requests (order_id);
create index if not exists customer_notifications_auth_user_id_idx on public.customer_notifications (auth_user_id, is_read);
create index if not exists reviews_auth_user_id_idx on public.reviews (auth_user_id);
create index if not exists reviews_product_id_idx on public.reviews (product_id);
drop index if exists public.customer_addresses_single_default_idx;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at
before update on public.customers
for each row execute function public.touch_updated_at();

drop trigger if exists customer_addresses_touch_updated_at on public.customer_addresses;
create trigger customer_addresses_touch_updated_at
before update on public.customer_addresses
for each row execute function public.touch_updated_at();

drop trigger if exists return_requests_touch_updated_at on public.return_requests;
create trigger return_requests_touch_updated_at
before update on public.return_requests
for each row execute function public.touch_updated_at();

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
before update on public.reviews
for each row execute function public.touch_updated_at();

create or replace function public.ensure_single_default_customer_address()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_default = true and new.auth_user_id is not null then
    update public.customer_addresses
    set is_default = false
    where auth_user_id = new.auth_user_id
      and id <> new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists customer_addresses_single_default_trigger on public.customer_addresses;
create trigger customer_addresses_single_default_trigger
after insert or update of is_default, auth_user_id
on public.customer_addresses
for each row
execute function public.ensure_single_default_customer_address();

create or replace function public.is_account_admin()
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

create or replace function public.send_customer_notification(
  p_auth_user_id uuid,
  p_title text,
  p_message text default null,
  p_type text default 'account'
)
returns public.customer_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  notification public.customer_notifications;
begin
  if public.is_account_admin() = false then
    raise exception 'Not authorized to send customer notifications';
  end if;

  insert into public.customer_notifications (auth_user_id, title, message, type, is_read)
  values (p_auth_user_id, p_title, p_message, coalesce(nullif(p_type, ''), 'account'), false)
  returning * into notification;

  return notification;
end;
$$;

create or replace function public.delete_my_customer_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_customer_id uuid;
begin
  if v_auth_user_id is null then
    raise exception 'You must be signed in to delete your account';
  end if;

  select id
  into v_customer_id
  from public.customers
  where auth_user_id = v_auth_user_id
  limit 1;

  delete from public.customer_addresses
  where auth_user_id = v_auth_user_id
     or (v_customer_id is not null and customer_id = v_customer_id);

  delete from public.wishlist
  where auth_user_id = v_auth_user_id
     or (v_customer_id is not null and customer_id = v_customer_id);

  delete from public.customer_notifications
  where auth_user_id = v_auth_user_id;

  delete from public.reviews
  where auth_user_id = v_auth_user_id;

  delete from public.return_requests
  where auth_user_id = v_auth_user_id;

  update public.orders
  set auth_user_id = null,
      customer_id = null
  where auth_user_id = v_auth_user_id
     or (v_customer_id is not null and customer_id = v_customer_id);

  delete from public.customers
  where auth_user_id = v_auth_user_id;

  delete from auth.users
  where id = v_auth_user_id;

  return jsonb_build_object('deleted', true);
end;
$$;

alter table public.customers enable row level security;
alter table public.admin_users enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.return_requests enable row level security;
alter table public.customer_notifications enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row"
on public.admin_users for select
using (auth.uid() = auth_user_id and is_active = true);

drop policy if exists "Customers can read own profile" on public.customers;
create policy "Customers can read own profile"
on public.customers for select
using (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers can insert own profile" on public.customers;
create policy "Customers can insert own profile"
on public.customers for insert
with check (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers can update own profile" on public.customers;
create policy "Customers can update own profile"
on public.customers for update
using (auth.uid() = auth_user_id or public.is_account_admin())
with check (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers manage own addresses" on public.customer_addresses;
create policy "Customers manage own addresses"
on public.customer_addresses for all
using (auth.uid() = auth_user_id or public.is_account_admin())
with check (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers manage own returns" on public.return_requests;
create policy "Customers manage own returns"
on public.return_requests for all
using (auth.uid() = auth_user_id or public.is_account_admin())
with check (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers read own notifications" on public.customer_notifications;
create policy "Customers read own notifications"
on public.customer_notifications for select
using (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers update own notifications" on public.customer_notifications;
create policy "Customers update own notifications"
on public.customer_notifications for update
using (auth.uid() = auth_user_id or public.is_account_admin())
with check (auth.uid() = auth_user_id or public.is_account_admin());

drop policy if exists "Customers manage own reviews" on public.reviews;
create policy "Customers manage own reviews"
on public.reviews for all
using (auth.uid() = auth_user_id or public.is_account_admin())
with check (auth.uid() = auth_user_id or public.is_account_admin());

grant select, insert, update on public.customers to authenticated;
grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;
grant select, insert, update on public.return_requests to authenticated;
grant select, update on public.customer_notifications to authenticated;
grant select, insert, update, delete on public.reviews to authenticated;
grant execute on function public.send_customer_notification(uuid, text, text, text) to authenticated;
grant execute on function public.delete_my_customer_account() to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.customer_notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.return_requests;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
