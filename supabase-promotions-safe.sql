-- Radios advanced coupons and promotions engine.
-- Safe to run more than once. Adds Supabase-backed promotion rules, checkout validation RPCs,
-- redemption tracking, and admin-only management policies.

create extension if not exists pgcrypto;

create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid()
);

alter table public.discounts add column if not exists code text;
alter table public.discounts add column if not exists title text;
alter table public.discounts add column if not exists description text;
alter table public.discounts add column if not exists discount_type text default 'percentage';
alter table public.discounts add column if not exists discount_value numeric default 0;
alter table public.discounts add column if not exists promotion_type text default 'coupon_code';
alter table public.discounts add column if not exists applies_to text default 'all';
alter table public.discounts add column if not exists product_ids uuid[] default '{}'::uuid[];
alter table public.discounts add column if not exists category_ids uuid[] default '{}'::uuid[];
alter table public.discounts add column if not exists category_slugs text[] default '{}'::text[];
alter table public.discounts add column if not exists collection_ids uuid[] default '{}'::uuid[];
alter table public.discounts add column if not exists tags text[] default '{}'::text[];
alter table public.discounts add column if not exists minimum_order_amount numeric default 0;
alter table public.discounts add column if not exists maximum_discount_amount numeric;
alter table public.discounts add column if not exists usage_limit integer;
alter table public.discounts add column if not exists used_count integer default 0;
alter table public.discounts add column if not exists usage_limit_per_customer integer default 1;
alter table public.discounts add column if not exists starts_at timestamp with time zone default now();
alter table public.discounts add column if not exists expires_at timestamp with time zone;
alter table public.discounts add column if not exists is_active boolean default true;
alter table public.discounts add column if not exists is_first_order_only boolean default false;
alter table public.discounts add column if not exists buy_quantity integer default 1;
alter table public.discounts add column if not exists get_quantity integer default 1;
alter table public.discounts add column if not exists combine_with_other_discounts boolean default false;
alter table public.discounts add column if not exists created_at timestamp with time zone default now();
alter table public.discounts add column if not exists updated_at timestamp with time zone default now();

alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_id uuid;
alter table public.orders add column if not exists discount_amount numeric default 0;
alter table public.orders add column if not exists promotion_title text;
alter table public.orders add column if not exists auth_user_id uuid;

create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid references public.discounts(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  auth_user_id uuid,
  customer_email text,
  code text,
  discount_amount numeric default 0,
  created_at timestamp with time zone default now()
);

alter table public.discount_redemptions add column if not exists discount_id uuid references public.discounts(id) on delete cascade;
alter table public.discount_redemptions add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.discount_redemptions add column if not exists auth_user_id uuid;
alter table public.discount_redemptions add column if not exists customer_email text;
alter table public.discount_redemptions add column if not exists code text;
alter table public.discount_redemptions add column if not exists discount_amount numeric default 0;
alter table public.discount_redemptions add column if not exists created_at timestamp with time zone default now();

update public.discounts
set
  discount_type = coalesce(nullif(discount_type, ''), 'percentage'),
  discount_value = coalesce(discount_value, 0),
  promotion_type = coalesce(nullif(promotion_type, ''), case when nullif(code, '') is null then 'automatic_discount' else 'coupon_code' end),
  applies_to = coalesce(nullif(applies_to, ''), 'all'),
  product_ids = coalesce(product_ids, '{}'::uuid[]),
  category_ids = coalesce(category_ids, '{}'::uuid[]),
  category_slugs = coalesce(category_slugs, '{}'::text[]),
  collection_ids = coalesce(collection_ids, '{}'::uuid[]),
  tags = coalesce(tags, '{}'::text[]),
  minimum_order_amount = coalesce(minimum_order_amount, 0),
  used_count = coalesce(used_count, 0),
  usage_limit_per_customer = coalesce(usage_limit_per_customer, 1),
  starts_at = coalesce(starts_at, now()),
  is_active = coalesce(is_active, true),
  is_first_order_only = coalesce(is_first_order_only, false),
  buy_quantity = greatest(coalesce(buy_quantity, 1), 1),
  get_quantity = greatest(coalesce(get_quantity, 1), 1),
  combine_with_other_discounts = coalesce(combine_with_other_discounts, false),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where true;

create unique index if not exists discounts_code_upper_unique_idx
on public.discounts (upper(code))
where code is not null and btrim(code) <> '';

create index if not exists discounts_active_window_idx
on public.discounts (is_active, starts_at, expires_at);

create index if not exists discounts_category_slugs_gin_idx
on public.discounts using gin(category_slugs);

create index if not exists discounts_product_ids_gin_idx
on public.discounts using gin(product_ids);

create index if not exists discount_redemptions_discount_idx
on public.discount_redemptions(discount_id, created_at desc);

create index if not exists discount_redemptions_customer_idx
on public.discount_redemptions(auth_user_id, lower(customer_email));

create unique index if not exists discount_redemptions_unique_order_discount_idx
on public.discount_redemptions(order_id, discount_id)
where order_id is not null and discount_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'discounts_discount_type_check'
      and conrelid = 'public.discounts'::regclass
  ) then
    alter table public.discounts
    add constraint discounts_discount_type_check
    check (discount_type in ('percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'discounts_promotion_type_check'
      and conrelid = 'public.discounts'::regclass
  ) then
    alter table public.discounts
    add constraint discounts_promotion_type_check
    check (promotion_type in ('coupon', 'coupon_code', 'automatic_discount', 'category_offer', 'combo_offer', 'first_order_offer', 'free_shipping', 'buy_x_get_y')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'discounts_applies_to_check'
      and conrelid = 'public.discounts'::regclass
  ) then
    alter table public.discounts
    add constraint discounts_applies_to_check
    check (applies_to in ('all', 'order', 'all_products', 'category', 'categories', 'specific_categories', 'product', 'products', 'specific_products', 'collection', 'collections', 'specific_collections', 'tag', 'tags')) not valid;
  end if;
end $$;

create or replace function public.promotion_admin_allowed()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed boolean := false;
begin
  if auth.role() = 'service_role' then
    return true;
  end if;

  if to_regclass('public.admin_users') is not null then
    execute
      'select exists (
        select 1
        from public.admin_users admin
        where admin.auth_user_id = $1
          and admin.is_active = true
          and admin.role in (''admin'', ''manager'')
      )'
    into allowed
    using auth.uid();
  end if;

  return coalesce(allowed, false);
end;
$$;

create or replace function public.promotion_slug(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.discount_cart_item_number(cart_item jsonb, field_name text, fallback numeric default 0)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(cart_item ->> field_name, '') ~ '^-?[0-9]+(\.[0-9]+)?$' then (cart_item ->> field_name)::numeric
    else fallback
  end;
$$;

create or replace function public.discount_cart_item_matches(discount_row public.discounts, cart_item jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  scope text := lower(coalesce(discount_row.applies_to, 'all'));
  item_product_id text := coalesce(cart_item ->> 'product_id', cart_item ->> 'productId', cart_item ->> 'id');
  item_category_id text := coalesce(cart_item ->> 'category_id', cart_item ->> 'categoryId');
  item_category_slug text := coalesce(cart_item ->> 'category_slug', cart_item ->> 'categorySlug', cart_item ->> 'category');
  item_collections jsonb := coalesce(cart_item -> 'collection_ids', cart_item -> 'collectionIds', '[]'::jsonb);
  item_tags jsonb := coalesce(cart_item -> 'tags', '[]'::jsonb);
  target_uuid uuid;
  target_text text;
  item_text text;
begin
  if scope in ('all', 'order', 'all_products') then
    return true;
  end if;

  if scope in ('product', 'products', 'specific_products') then
    foreach target_uuid in array coalesce(discount_row.product_ids, '{}'::uuid[]) loop
      if target_uuid::text = item_product_id then
        return true;
      end if;
    end loop;
    return false;
  end if;

  if scope in ('category', 'categories', 'specific_categories') then
    foreach target_uuid in array coalesce(discount_row.category_ids, '{}'::uuid[]) loop
      if target_uuid::text = item_category_id then
        return true;
      end if;
    end loop;

    foreach target_text in array coalesce(discount_row.category_slugs, '{}'::text[]) loop
      if public.promotion_slug(target_text) = public.promotion_slug(item_category_slug) then
        return true;
      end if;
    end loop;

    return false;
  end if;

  if scope in ('collection', 'collections', 'specific_collections') then
    if jsonb_typeof(item_collections) = 'array' then
      foreach target_uuid in array coalesce(discount_row.collection_ids, '{}'::uuid[]) loop
        for item_text in select jsonb_array_elements_text(item_collections) loop
          if target_uuid::text = item_text then
            return true;
          end if;
        end loop;
      end loop;
    end if;
    return false;
  end if;

  if scope in ('tag', 'tags') then
    if jsonb_typeof(item_tags) = 'array' then
      foreach target_text in array coalesce(discount_row.tags, '{}'::text[]) loop
        for item_text in select jsonb_array_elements_text(item_tags) loop
          if public.promotion_slug(target_text) = public.promotion_slug(item_text) then
            return true;
          end if;
        end loop;
      end loop;
    elsif jsonb_typeof(item_tags) = 'string' then
      foreach target_text in array coalesce(discount_row.tags, '{}'::text[]) loop
        if public.promotion_slug(target_text) = public.promotion_slug(item_tags #>> '{}') then
          return true;
        end if;
      end loop;
    end if;
    return false;
  end if;

  return false;
end;
$$;

create or replace function public.discount_buy_x_get_y_amount(discount_row public.discounts, cart_items jsonb)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  eligible_quantity integer := 0;
  discounted_units integer := 0;
  set_size integer := greatest(coalesce(discount_row.buy_quantity, 1), 1) + greatest(coalesce(discount_row.get_quantity, 1), 1);
  amount numeric := 0;
begin
  select coalesce(sum(public.discount_cart_item_number(item, 'quantity', 0))::integer, 0)
  into eligible_quantity
  from jsonb_array_elements(coalesce(cart_items, '[]'::jsonb)) item
  where public.discount_cart_item_matches(discount_row, item);

  discounted_units := floor(eligible_quantity::numeric / greatest(set_size, 1))::integer * greatest(coalesce(discount_row.get_quantity, 1), 1);

  if discounted_units <= 0 then
    return 0;
  end if;

  select coalesce(sum(unit_price), 0)
  into amount
  from (
    select public.discount_cart_item_number(item, 'price', 0) as unit_price
    from jsonb_array_elements(coalesce(cart_items, '[]'::jsonb)) item
    cross join lateral generate_series(1, greatest(public.discount_cart_item_number(item, 'quantity', 0)::integer, 0)) unit_number
    where public.discount_cart_item_matches(discount_row, item)
    order by public.discount_cart_item_number(item, 'price', 0) asc
    limit discounted_units
  ) discounted_units_table;

  return greatest(coalesce(amount, 0), 0);
end;
$$;

create or replace function public.validate_discount(
  coupon_code text,
  cart_items jsonb,
  order_subtotal numeric,
  auth_user_id uuid default null,
  customer_email text default null
)
returns table (
  is_valid boolean,
  discount_id uuid,
  discount_amount numeric,
  message text,
  discount_code text,
  title text,
  discount_type text,
  promotion_type text,
  applies_to text,
  eligible_subtotal numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(btrim(coalesce($1, '')));
  cart jsonb := case when jsonb_typeof(coalesce($2, '[]'::jsonb)) = 'array' then coalesce($2, '[]'::jsonb) else '[]'::jsonb end;
  subtotal numeric := greatest(coalesce($3, 0), 0);
  request_auth_user_id uuid := $4;
  request_customer_email text := lower(btrim(coalesce($5, '')));
  candidate public.discounts%rowtype;
  candidate_seen boolean := false;
  candidate_valid boolean := false;
  candidate_amount numeric := 0;
  candidate_subtotal numeric := 0;
  candidate_quantity integer := 0;
  best_amount numeric := -1;
  best_subtotal numeric := 0;
  best_rule public.discounts%rowtype;
  last_message text := '';
  per_customer_count integer := 0;
  previous_order_exists boolean := false;
begin
  if subtotal <= 0 or jsonb_array_length(cart) = 0 then
    return query select false, null::uuid, 0::numeric, 'Add products before applying a promotion.', null::text, null::text, null::text, null::text, null::text, 0::numeric;
    return;
  end if;

  for candidate in
    select *
    from public.discounts d
    where case
      when normalized_code <> '' then upper(btrim(coalesce(d.code, ''))) = normalized_code
      else (
        coalesce(d.promotion_type, '') in ('automatic_discount', 'category_offer', 'combo_offer', 'first_order_offer', 'free_shipping', 'buy_x_get_y')
        or (coalesce(d.code, '') = '' and coalesce(d.promotion_type, '') <> 'coupon_code')
      )
    end
    order by d.created_at desc nulls last
  loop
    candidate_seen := true;
    candidate_valid := true;
    candidate_amount := 0;
    candidate_subtotal := 0;
    candidate_quantity := 0;
    last_message := '';

    if candidate.is_active is not true then
      candidate_valid := false;
      last_message := 'This promotion is inactive.';
    elsif candidate.starts_at is not null and candidate.starts_at > now() then
      candidate_valid := false;
      last_message := 'This promotion has not started yet.';
    elsif candidate.expires_at is not null and candidate.expires_at < now() then
      candidate_valid := false;
      last_message := 'This promotion has expired.';
    elsif candidate.usage_limit is not null and coalesce(candidate.used_count, 0) >= candidate.usage_limit then
      candidate_valid := false;
      last_message := 'This promotion has reached its usage limit.';
    elsif subtotal < coalesce(candidate.minimum_order_amount, 0) then
      candidate_valid := false;
      last_message := 'Minimum order amount for this promotion is not met.';
    end if;

    if candidate_valid and coalesce(candidate.usage_limit_per_customer, 0) > 0 and (request_auth_user_id is not null or request_customer_email <> '') then
      select count(*)
      into per_customer_count
      from public.discount_redemptions redemption
      where redemption.discount_id = candidate.id
        and (
          (request_auth_user_id is not null and redemption.auth_user_id = request_auth_user_id)
          or (request_customer_email <> '' and lower(coalesce(redemption.customer_email, '')) = request_customer_email)
        );

      if per_customer_count >= candidate.usage_limit_per_customer then
        candidate_valid := false;
        last_message := 'This promotion has already been used by this customer.';
      end if;
    end if;

    if candidate_valid and candidate.is_first_order_only is true then
      if request_auth_user_id is null and request_customer_email = '' then
        candidate_valid := false;
        last_message := 'Sign in or enter your email to use this first-order offer.';
      else
        select exists(
          select 1
          from public.orders order_row
          where (
            (request_auth_user_id is not null and order_row.auth_user_id = request_auth_user_id)
            or (request_customer_email <> '' and lower(coalesce(order_row.customer_email, '')) = request_customer_email)
          )
          and lower(coalesce(order_row.status, '')) not in ('cancelled', 'canceled', 'refunded', 'returned', 'failed')
        )
        into previous_order_exists;

        if previous_order_exists then
          candidate_valid := false;
          last_message := 'This offer is valid only on your first order.';
        end if;
      end if;
    end if;

    if candidate_valid then
      select
        coalesce(sum(public.discount_cart_item_number(item, 'price', 0) * public.discount_cart_item_number(item, 'quantity', 0)), 0),
        coalesce(sum(public.discount_cart_item_number(item, 'quantity', 0))::integer, 0)
      into candidate_subtotal, candidate_quantity
      from jsonb_array_elements(cart) item
      where public.discount_cart_item_matches(candidate, item);

      if candidate_subtotal <= 0 then
        candidate_valid := false;
        last_message := 'This promotion applies to eligible items only.';
      end if;
    end if;

    if candidate_valid then
      if candidate.discount_type = 'percentage' then
        candidate_amount := candidate_subtotal * (greatest(coalesce(candidate.discount_value, 0), 0) / 100);
      elsif candidate.discount_type = 'fixed_amount' then
        candidate_amount := least(greatest(coalesce(candidate.discount_value, 0), 0), candidate_subtotal);
      elsif candidate.discount_type = 'buy_x_get_y' then
        candidate_amount := public.discount_buy_x_get_y_amount(candidate, cart);
        if candidate_amount <= 0 then
          candidate_valid := false;
          last_message := 'Add the required quantity to unlock this combo offer.';
        end if;
      elsif candidate.discount_type = 'free_shipping' then
        candidate_amount := 0;
      else
        candidate_valid := false;
        last_message := 'Unsupported promotion type.';
      end if;
    end if;

    if candidate_valid then
      if candidate.maximum_discount_amount is not null and candidate.maximum_discount_amount > 0 then
        candidate_amount := least(candidate_amount, candidate.maximum_discount_amount);
      end if;

      candidate_amount := round(greatest(least(candidate_amount, candidate_subtotal), 0), 2);

      if normalized_code <> '' or candidate_amount >= best_amount then
        best_amount := candidate_amount;
        best_subtotal := candidate_subtotal;
        best_rule := candidate;
      end if;

      if normalized_code <> '' then
        exit;
      end if;
    end if;
  end loop;

  if best_amount >= 0 and best_rule.id is not null then
    return query select
      true,
      best_rule.id,
      best_amount,
      case
        when best_rule.discount_type = 'free_shipping' then 'Free shipping promotion applied.'
        when best_rule.applies_to in ('category', 'categories', 'specific_categories') then 'Coupon applied to eligible category items only.'
        else 'Promotion applied successfully.'
      end,
      best_rule.code,
      best_rule.title,
      best_rule.discount_type,
      best_rule.promotion_type,
      best_rule.applies_to,
      best_subtotal;
    return;
  end if;

  if not candidate_seen then
    return query select false, null::uuid, 0::numeric, case when normalized_code <> '' then 'Coupon code not found.' else 'No automatic promotion applies.' end, null::text, null::text, null::text, null::text, null::text, 0::numeric;
    return;
  end if;

  return query select false, null::uuid, 0::numeric, coalesce(nullif(last_message, ''), 'This promotion is not eligible for the current cart.'), null::text, null::text, null::text, null::text, null::text, 0::numeric;
end;
$$;

create or replace function public.finalize_discount_redemption(
  coupon_code text,
  cart_items jsonb,
  order_subtotal numeric,
  order_id uuid,
  auth_user_id uuid default null,
  customer_email text default null
)
returns table (
  is_valid boolean,
  discount_id uuid,
  discount_amount numeric,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  validation record;
  locked_discount public.discounts%rowtype;
  inserted_count integer := 0;
begin
  select *
  into validation
  from public.validate_discount($1, $2, $3, $5, $6)
  limit 1;

  if validation.is_valid is not true or validation.discount_id is null then
    return query select false, null::uuid, 0::numeric, coalesce(validation.message, 'Promotion could not be finalized.');
    return;
  end if;

  select *
  into locked_discount
  from public.discounts d
  where d.id = validation.discount_id
  for update;

  if locked_discount.usage_limit is not null and coalesce(locked_discount.used_count, 0) >= locked_discount.usage_limit then
    return query select false, locked_discount.id, 0::numeric, 'This promotion has reached its usage limit.';
    return;
  end if;

  with inserted as (
    insert into public.discount_redemptions (
      discount_id,
      order_id,
      auth_user_id,
      customer_email,
      code,
      discount_amount
    )
    values (
      validation.discount_id,
      $4,
      $5,
      nullif(lower(btrim(coalesce($6, ''))), ''),
      validation.discount_code,
      validation.discount_amount
    )
    on conflict do nothing
    returning id
  )
  select count(*) into inserted_count from inserted;

  if inserted_count > 0 then
    update public.discounts
    set used_count = coalesce(used_count, 0) + 1,
        updated_at = now()
    where id = validation.discount_id;
  end if;

  update public.orders
  set coupon_code = coalesce(validation.discount_code, nullif(upper(btrim(coalesce($1, ''))), '')),
      discount_id = validation.discount_id,
      discount_amount = validation.discount_amount,
      promotion_title = validation.title
  where id = $4;

  return query select true, validation.discount_id, validation.discount_amount, 'Promotion redemption recorded.';
end;
$$;

alter table public.discounts enable row level security;
alter table public.discount_redemptions enable row level security;

drop policy if exists "Public can read active promotions" on public.discounts;
create policy "Public can read active promotions"
on public.discounts
for select
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (expires_at is null or expires_at >= now())
);

drop policy if exists "Admins can manage promotions" on public.discounts;
create policy "Admins can manage promotions"
on public.discounts
for all
using (public.promotion_admin_allowed())
with check (public.promotion_admin_allowed());

drop policy if exists "Admins can manage discount redemptions" on public.discount_redemptions;
create policy "Admins can manage discount redemptions"
on public.discount_redemptions
for all
using (public.promotion_admin_allowed())
with check (public.promotion_admin_allowed());

drop policy if exists "Customers can read their discount redemptions" on public.discount_redemptions;
create policy "Customers can read their discount redemptions"
on public.discount_redemptions
for select
using (auth_user_id = auth.uid());

grant select on public.discounts to anon, authenticated;
grant select on public.discount_redemptions to authenticated;
grant execute on function public.validate_discount(text, jsonb, numeric, uuid, text) to anon, authenticated;
grant execute on function public.finalize_discount_redemption(text, jsonb, numeric, uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
