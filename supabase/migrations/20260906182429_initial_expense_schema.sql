create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  telegram_user_id bigint unique not null,
  display_name text not null default 'Owner',
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('bank', 'credit_card', 'cash', 'wallet', 'other')),
  is_active boolean not null default true,
  unique (user_id, name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text,
  is_active boolean not null default true,
  unique (user_id, name)
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  is_owner boolean not null default false,
  is_active boolean not null default true,
  unique (user_id, name)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  unique (user_id, name)
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  default_weight numeric(10, 4) not null default 1 check (default_weight > 0),
  unique (group_id, person_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  occurred_on date not null,
  merchant text not null,
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  status text not null check (status in ('confirmed', 'needs_review')),
  notes text check (char_length(notes) <= 1000),
  source text not null check (source in ('manual', 'telegram', 'receipt', 'ollama', 'on_device_model')),
  source_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_fingerprint)
);

create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  name text not null,
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  amount_paise bigint not null check (amount_paise >= 0),
  owner_person_id uuid references public.people(id) on delete set null
);

create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  amount_paise bigint not null check (amount_paise >= 0),
  unique (transaction_id, person_id)
);

create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  merchant_pattern text not null,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  priority integer not null default 100,
  is_active boolean not null default true
);

create table public.telegram_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  telegram_update_id bigint not null,
  processed_at timestamptz not null default now(),
  unique (user_id, telegram_update_id)
);

create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);
create index transactions_user_status_idx on public.transactions (user_id, status);
create index allocations_transaction_idx on public.allocations (transaction_id);
create index transaction_items_transaction_idx on public.transaction_items (transaction_id);
create index merchant_rules_user_priority_idx on public.merchant_rules (user_id, priority);

create view public.monthly_expense_summary
with (security_invoker = true)
as
select
  t.user_id,
  date_trunc('month', t.occurred_on)::date as month,
  coalesce(c.name, 'Uncategorized') as category,
  sum(t.amount_paise)::bigint as amount_paise,
  count(*)::bigint as transaction_count
from public.transactions t
left join public.categories c on c.id = t.category_id
group by t.user_id, date_trunc('month', t.occurred_on)::date, coalesce(c.name, 'Uncategorized');

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.people enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.allocations enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.telegram_updates enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "accounts_select_own" on public.accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "accounts_insert_own" on public.accounts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "accounts_update_own" on public.accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "accounts_delete_own" on public.accounts for delete to authenticated using ((select auth.uid()) = user_id);

create policy "categories_select_own" on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories_insert_own" on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories_update_own" on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories_delete_own" on public.categories for delete to authenticated using ((select auth.uid()) = user_id);

create policy "people_select_own" on public.people for select to authenticated using ((select auth.uid()) = user_id);
create policy "people_insert_own" on public.people for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "people_update_own" on public.people for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "people_delete_own" on public.people for delete to authenticated using ((select auth.uid()) = user_id);

create policy "groups_select_own" on public.groups for select to authenticated using ((select auth.uid()) = user_id);
create policy "groups_insert_own" on public.groups for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "groups_update_own" on public.groups for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "groups_delete_own" on public.groups for delete to authenticated using ((select auth.uid()) = user_id);

create policy "group_members_select_own" on public.group_members for select to authenticated using ((select auth.uid()) = user_id);
create policy "group_members_insert_own" on public.group_members for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "group_members_update_own" on public.group_members for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "group_members_delete_own" on public.group_members for delete to authenticated using ((select auth.uid()) = user_id);

create policy "transactions_select_own" on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions_insert_own" on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transactions_update_own" on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions_delete_own" on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "transaction_items_select_own" on public.transaction_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "transaction_items_insert_own" on public.transaction_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transaction_items_update_own" on public.transaction_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transaction_items_delete_own" on public.transaction_items for delete to authenticated using ((select auth.uid()) = user_id);

create policy "allocations_select_own" on public.allocations for select to authenticated using ((select auth.uid()) = user_id);
create policy "allocations_insert_own" on public.allocations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "allocations_update_own" on public.allocations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "allocations_delete_own" on public.allocations for delete to authenticated using ((select auth.uid()) = user_id);

create policy "merchant_rules_select_own" on public.merchant_rules for select to authenticated using ((select auth.uid()) = user_id);
create policy "merchant_rules_insert_own" on public.merchant_rules for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "merchant_rules_update_own" on public.merchant_rules for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "merchant_rules_delete_own" on public.merchant_rules for delete to authenticated using ((select auth.uid()) = user_id);

create policy "telegram_updates_select_own" on public.telegram_updates for select to authenticated using ((select auth.uid()) = user_id);
create policy "telegram_updates_insert_own" on public.telegram_updates for insert to authenticated with check ((select auth.uid()) = user_id);

grant select on public.monthly_expense_summary to authenticated;
