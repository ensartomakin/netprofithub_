-- NetProfitHub (MVP) - Supabase Postgres Şeması
-- Not: `api_keys` alanı hassas veridir; prod ortamda şifreleme/secret manager önerilir.

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type store_platform as enum ('shopify', 'woocommerce', 'amazon', 'etsy', 'manual');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type product_status as enum ('aktif', 'pasif', 'dnr');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type order_status as enum ('odendi', 'iade', 'iptal', 'beklemede');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type expense_recurrence as enum ('tek_sefer', 'aylik', 'yillik');
exception
  when duplicate_object then null;
end $$;

-- Stores
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  platform store_platform not null default 'manual',
  api_keys jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stores_owner_id_idx on public.stores (owner_id);

-- Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  sku text not null,
  name text not null,
  cogs numeric(12, 2) not null default 0,
  stock_level integer not null default 0,
  -- velocity: ortalama günlük satış adedi (L7/L30 gibi)
  velocity numeric(12, 4) not null default 0,
  status product_status not null default 'aktif',
  dnr boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, sku)
);

create index if not exists products_store_id_idx on public.products (store_id);
create index if not exists products_status_idx on public.products (store_id, status);

-- Orders (özet seviyede)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  external_order_id bigint,
  amount numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  shipping numeric(12, 2) not null default 0,
  status order_status not null default 'odendi',
  customer_id text,
  ordered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists orders_store_id_ordered_at_idx on public.orders (store_id, ordered_at desc);
create index if not exists orders_status_idx on public.orders (store_id, status);
create unique index if not exists orders_store_external_order_id_ux on public.orders (store_id, external_order_id);

-- Order items (ürün kârlılığı için MVP satır kalemleri)
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  external_line_item_id bigint,
  sku text not null,
  name text,
  quantity integer not null default 1,
  unit_price numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  returned_quantity integer not null default 0,
  ordered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists order_items_store_ordered_at_idx on public.order_items (store_id, ordered_at desc);
create index if not exists order_items_sku_idx on public.order_items (store_id, sku);
create unique index if not exists order_items_store_external_line_item_id_ux
  on public.order_items (store_id, external_line_item_id);

-- Marketing spend (kampanya seviyesinde)
create table if not exists public.marketing_spend (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  platform text not null, -- meta/google/tiktok vb.
  spend numeric(12, 2) not null default 0,
  date date not null,
  campaign_name text,
  created_at timestamptz not null default now()
);

create index if not exists marketing_spend_store_date_idx on public.marketing_spend (store_id, date desc);
create index if not exists marketing_spend_platform_idx on public.marketing_spend (store_id, platform);

-- Expenses (sabit & değişken)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  category text not null,
  amount numeric(12, 2) not null default 0,
  recurring_status expense_recurrence not null default 'tek_sefer',
  effective_date date not null default (now()::date),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_store_effective_date_idx on public.expenses (store_id, effective_date desc);

-- RLS (baseline)
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.marketing_spend enable row level security;
alter table public.expenses enable row level security;

-- Stores policies
do $$ begin
  create policy "stores_select_own" on public.stores
    for select using (auth.uid() = owner_id);
  create policy "stores_insert_own" on public.stores
    for insert with check (auth.uid() = owner_id);
  create policy "stores_update_own" on public.stores
    for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  create policy "stores_delete_own" on public.stores
    for delete using (auth.uid() = owner_id);
exception
  when duplicate_object then null;
end $$;

-- Child table policies (store üzerinden yetkilendir)
do $$ begin
  create policy "products_crud_own_store" on public.products
    for all
    using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()))
    with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

  create policy "orders_crud_own_store" on public.orders
    for all
    using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()))
    with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

  create policy "order_items_crud_own_store" on public.order_items
    for all
    using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()))
    with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

  create policy "marketing_spend_crud_own_store" on public.marketing_spend
    for all
    using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()))
    with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

  create policy "expenses_crud_own_store" on public.expenses
    for all
    using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()))
    with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
exception
  when duplicate_object then null;
end $$;
