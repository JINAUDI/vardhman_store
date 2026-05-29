-- Vardhman Store + Dashcode order lifecycle upgrade.
-- Safe to run more than once. It only adds missing columns/tables/policies and backfills empty lifecycle fields.

create extension if not exists pgcrypto;

alter table public.orders add column if not exists order_status text default 'pending';
alter table public.orders add column if not exists payment_status text default 'pending';
alter table public.orders add column if not exists fulfillment_status text default 'unfulfilled';
alter table public.orders add column if not exists refund_status text default 'none';
alter table public.orders add column if not exists tracking_status text default 'Order Placed';
alter table public.orders add column if not exists courier_name text;
alter table public.orders add column if not exists courier_tracking_number text;
alter table public.orders add column if not exists estimated_delivery_date date;
alter table public.orders add column if not exists shipped_at timestamp with time zone;
alter table public.orders add column if not exists delivered_at timestamp with time zone;
alter table public.orders add column if not exists cancelled_at timestamp with time zone;
alter table public.orders add column if not exists refunded_at timestamp with time zone;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists refund_reason text;
alter table public.orders add column if not exists admin_notes text;
alter table public.orders add column if not exists invoice_number text unique;
alter table public.orders add column if not exists invoice_url text;
alter table public.orders add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  status text not null,
  status_type text default 'order',
  note text,
  created_by text default 'system',
  created_at timestamp with time zone default now()
);

create table if not exists public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  refund_amount numeric default 0,
  refund_reason text,
  refund_status text default 'requested',
  processed_by text,
  created_at timestamp with time zone default now(),
  processed_at timestamp with time zone
);

create table if not exists public.order_cancellations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  cancellation_reason text,
  cancelled_by text default 'customer',
  created_at timestamp with time zone default now()
);

update public.orders
set
  order_status = coalesce(nullif(order_status, ''), nullif(status, ''), 'pending'),
  payment_status = coalesce(
    nullif(payment_status, ''),
    case when payment_method = 'cash_on_delivery' then 'cod_pending' else 'pending' end
  ),
  fulfillment_status = coalesce(
    nullif(fulfillment_status, ''),
    case
      when shipping_status in ('delivered', 'returned') then shipping_status
      when shipping_status in ('in_transit', 'out_for_delivery') then 'partially_fulfilled'
      else 'unfulfilled'
    end
  ),
  refund_status = coalesce(nullif(refund_status, ''), 'none'),
  tracking_status = coalesce(nullif(tracking_status, ''), 'Order Placed'),
  courier_name = coalesce(nullif(courier_name, ''), nullif(courier, '')),
  courier_tracking_number = coalesce(nullif(courier_tracking_number, ''), nullif(tracking_id, '')),
  updated_at = coalesce(updated_at, created_at, now())
where true;

update public.orders
set invoice_number = 'INV-' || to_char(coalesce(created_at, now()), 'YYYYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 6))
where invoice_number is null or invoice_number = '';

insert into public.order_status_history (order_id, status, status_type, note, created_by, created_at)
select
  o.id,
  coalesce(nullif(o.order_status, ''), nullif(o.status, ''), 'pending'),
  'order',
  'Order placed successfully',
  'system',
  coalesce(o.created_at, now())
from public.orders o
where not exists (
  select 1
  from public.order_status_history h
  where h.order_id = o.id
    and h.status_type = 'order'
);

alter table public.order_status_history enable row level security;
alter table public.order_refunds enable row level security;
alter table public.order_cancellations enable row level security;

drop policy if exists "Public can read order status history" on public.order_status_history;
create policy "Public can read order status history"
on public.order_status_history
for select
using (true);

drop policy if exists "Dashboard can manage order status history" on public.order_status_history;
create policy "Dashboard can manage order status history"
on public.order_status_history
for all
using (true)
with check (true);

drop policy if exists "Dashboard can manage refunds" on public.order_refunds;
create policy "Dashboard can manage refunds"
on public.order_refunds
for all
using (true)
with check (true);

drop policy if exists "Dashboard can manage cancellations" on public.order_cancellations;
create policy "Dashboard can manage cancellations"
on public.order_cancellations
for all
using (true)
with check (true);

do $$
begin
  alter publication supabase_realtime add table public.order_status_history;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.order_refunds;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.order_cancellations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

grant select, insert on public.order_status_history to anon, authenticated;
grant select, insert, update on public.order_refunds to anon, authenticated;
grant select, insert, update on public.order_cancellations to anon, authenticated;

notify pgrst, 'reload schema';
