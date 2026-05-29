-- Vardhman Store smart product search.
-- Safe to run more than once. Adds typo-tolerant search, analytics, and admin-editable keywords.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

alter table public.products add column if not exists title text;
alter table public.products add column if not exists name text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists price numeric(12,2) default 0;
alter table public.products add column if not exists compare_at_price numeric(12,2);
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists image text;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists category_slug text;
alter table public.products add column if not exists tags text[] default '{}'::text[];
alter table public.products add column if not exists visible boolean default true;
alter table public.products add column if not exists is_active boolean default true;
alter table public.products add column if not exists status text default 'active';
alter table public.products add column if not exists search_keywords text;
alter table public.products add column if not exists search_vector tsvector;

create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  session_id text,
  auth_user_id uuid,
  results_count integer default 0,
  clicked_product_id uuid references public.products(id) on delete set null,
  created_at timestamp with time zone default now()
);

create index if not exists products_search_vector_idx on public.products using gin(search_vector);
create index if not exists products_title_trgm_idx on public.products using gin(title gin_trgm_ops);
create index if not exists products_name_trgm_idx on public.products using gin(name gin_trgm_ops);
create index if not exists products_search_keywords_trgm_idx on public.products using gin(search_keywords gin_trgm_ops);
create index if not exists search_events_query_idx on public.search_events(query);
create index if not exists search_events_created_at_idx on public.search_events(created_at desc);
create index if not exists search_events_clicked_product_idx on public.search_events(clicked_product_id);

create or replace function public.products_search_document(p_product public.products)
returns text
language sql
immutable
as $$
  select trim(concat_ws(' ',
    p_product.title,
    p_product.name,
    p_product.description,
    p_product.sku,
    p_product.category,
    p_product.category_slug,
    p_product.search_keywords,
    array_to_string(p_product.tags, ' ')
  ));
$$;

create or replace function public.refresh_product_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.category, '') || ' ' || coalesce(new.category_slug, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.sku, '') || ' ' || coalesce(array_to_string(new.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.description, '') || ' ' || coalesce(new.search_keywords, '')), 'C');
  return new;
end;
$$;

drop trigger if exists products_refresh_search_vector on public.products;
create trigger products_refresh_search_vector
before insert or update of title, name, description, sku, category, category_slug, tags, search_keywords
on public.products
for each row
execute function public.refresh_product_search_vector();

update public.products
set search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(category, '') || ' ' || coalesce(category_slug, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(sku, '') || ' ' || coalesce(array_to_string(tags, ' '), '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(description, '') || ' ' || coalesce(search_keywords, '')), 'C')
where true;

create or replace function public.search_products(
  search_query text,
  category_filter text default null,
  limit_count integer default 10
)
returns table (
  id uuid,
  title text,
  name text,
  price numeric,
  compare_at_price numeric,
  image_url text,
  image text,
  category text,
  category_slug text,
  similarity_score real
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      lower(trim(coalesce(search_query, ''))) as q,
      nullif(lower(trim(coalesce(category_filter, ''))), '') as cat,
      greatest(1, least(coalesce(limit_count, 10), 50)) as max_rows
  ),
  matched as (
    select
      p.id,
      p.title,
      p.name,
      p.price,
      p.compare_at_price,
      p.image_url,
      p.image,
      p.category,
      p.category_slug,
      greatest(
        similarity(lower(coalesce(p.title, '')), n.q),
        similarity(lower(coalesce(p.name, '')), n.q),
        similarity(lower(coalesce(p.category, '')), n.q),
        similarity(lower(coalesce(p.category_slug, '')), n.q),
        similarity(lower(coalesce(p.search_keywords, '')), n.q),
        similarity(lower(coalesce(p.sku, '')), n.q),
        similarity(lower(coalesce(array_to_string(p.tags, ' '), '')), n.q)
      )::real as similarity_score,
      case
        when lower(coalesce(p.title, '')) = n.q or lower(coalesce(p.name, '')) = n.q then 1
        when lower(coalesce(p.title, '')) like n.q || '%' or lower(coalesce(p.name, '')) like n.q || '%' then 2
        when lower(coalesce(p.category_slug, '')) = n.q or lower(coalesce(p.category, '')) = n.q then 3
        when lower(coalesce(array_to_string(p.tags, ' '), '')) like '%' || n.q || '%' then 4
        else 5
      end as priority
    from public.products p
    cross join normalized n
    where length(n.q) >= 2
      and (coalesce(p.visible, false) = true or coalesce(p.is_active, false) = true)
      and lower(coalesce(p.status, 'active')) not in ('draft', 'hidden', 'archived', 'inactive', 'unpublished', 'disabled', 'deleted')
      and (
        n.cat is null
        or lower(coalesce(p.category_slug, '')) = n.cat
        or lower(regexp_replace(coalesce(p.category, ''), '[^a-zA-Z0-9]+', '-', 'g')) = n.cat
      )
      and (
        p.search_vector @@ plainto_tsquery('simple', n.q)
        or lower(public.products_search_document(p)) like '%' || n.q || '%'
        or similarity(lower(coalesce(p.title, '')), n.q) > 0.22
        or similarity(lower(coalesce(p.name, '')), n.q) > 0.22
        or similarity(lower(coalesce(p.search_keywords, '')), n.q) > 0.22
        or similarity(lower(coalesce(p.sku, '')), n.q) > 0.22
        or similarity(lower(coalesce(array_to_string(p.tags, ' '), '')), n.q) > 0.22
      )
  )
  select
    matched.id,
    matched.title,
    matched.name,
    matched.price,
    matched.compare_at_price,
    matched.image_url,
    matched.image,
    matched.category,
    matched.category_slug,
    matched.similarity_score
  from matched
  cross join normalized n
  order by matched.priority asc, matched.similarity_score desc, coalesce(matched.title, matched.name) asc
  limit (select max_rows from normalized);
$$;

create or replace function public.get_trending_searches(limit_count integer default 5)
returns table (
  query text,
  search_count bigint,
  last_searched_at timestamp with time zone
)
language sql
stable
security definer
set search_path = public
as $$
  select
    trim(query) as query,
    count(*) as search_count,
    max(created_at) as last_searched_at
  from public.search_events
  where created_at >= now() - interval '30 days'
    and clicked_product_id is null
    and length(trim(query)) >= 2
  group by trim(query)
  order by search_count desc, last_searched_at desc
  limit greatest(1, least(coalesce(limit_count, 5), 10));
$$;

create or replace function public.search_events_admin_allowed()
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

alter table public.search_events enable row level security;

drop policy if exists "Storefront can create search events" on public.search_events;
create policy "Storefront can create search events"
on public.search_events
for insert
with check (true);

drop policy if exists "Review search analytics admins can read search events" on public.search_events;
drop policy if exists "Search analytics admins can read search events" on public.search_events;
create policy "Search analytics admins can read search events"
on public.search_events
for select
using (public.search_events_admin_allowed());

drop policy if exists "Admins can update product search keywords" on public.products;
create policy "Admins can update product search keywords"
on public.products
for update
using (public.search_events_admin_allowed())
with check (public.search_events_admin_allowed());

grant execute on function public.search_products(text, text, integer) to anon, authenticated;
grant execute on function public.get_trending_searches(integer) to anon, authenticated;
grant insert on public.search_events to anon, authenticated;
grant select on public.search_events to authenticated;
grant update(search_keywords) on public.products to authenticated;

notify pgrst, 'reload schema';
