alter table public.transactions
add column deleted_at timestamptz;

create index transactions_active_user_date_idx
on public.transactions (user_id, occurred_on desc)
where deleted_at is null;

create index transactions_deleted_user_date_idx
on public.transactions (user_id, deleted_at desc)
where deleted_at is not null;
