-- Safe Shiprocket integration fields for existing Vardhman Store Supabase projects.
-- Run this once in Supabase SQL editor if you want Shiprocket IDs/status stored on orders.

alter table public.orders add column if not exists shiprocket_order_id text;
alter table public.orders add column if not exists shiprocket_shipment_id text;
alter table public.orders add column if not exists shiprocket_awb_code text;
alter table public.orders add column if not exists shiprocket_sync_status text default 'pending';
alter table public.orders add column if not exists shiprocket_synced_at timestamp with time zone;
alter table public.orders add column if not exists shiprocket_last_error text;

create index if not exists idx_orders_shiprocket_order_id
on public.orders (shiprocket_order_id);

create index if not exists idx_orders_shiprocket_shipment_id
on public.orders (shiprocket_shipment_id);
