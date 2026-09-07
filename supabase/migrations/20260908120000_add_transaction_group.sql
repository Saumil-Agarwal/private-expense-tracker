alter table public.transactions
add column group_id uuid references public.groups(id) on delete set null;

create index transactions_group_idx on public.transactions (group_id);
