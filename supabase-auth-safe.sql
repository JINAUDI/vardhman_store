create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text,
  email text unique,
  phone text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

alter table public.customers add column if not exists auth_user_id uuid unique;
alter table public.customers add column if not exists full_name text;
alter table public.customers add column if not exists email text;
alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists is_active boolean default true;
alter table public.customers add column if not exists created_at timestamp with time zone default now();

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

alter table public.orders add column if not exists auth_user_id uuid;
alter table public.orders add column if not exists customer_id uuid;
alter table public.wishlist add column if not exists auth_user_id uuid;
alter table public.wishlist add column if not exists session_id text;

alter table public.customers enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Customers can read own profile" on public.customers;
create policy "Customers can read own profile"
on public.customers
for select
using (auth.uid() = auth_user_id);

drop policy if exists "Customers can insert own profile" on public.customers;
create policy "Customers can insert own profile"
on public.customers
for insert
with check (auth.uid() = auth_user_id);

drop policy if exists "Customers can update own profile" on public.customers;
create policy "Customers can update own profile"
on public.customers
for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users
for select
using (auth.uid() = auth_user_id and is_active = true);

notify pgrst, 'reload schema';
