create index allocations_person_idx on public.allocations (person_id);
create index allocations_user_idx on public.allocations (user_id);

create index group_members_person_idx on public.group_members (person_id);
create index group_members_user_idx on public.group_members (user_id);

create index merchant_rules_account_idx on public.merchant_rules (account_id);
create index merchant_rules_category_idx on public.merchant_rules (category_id);

create index transaction_items_owner_person_idx on public.transaction_items (owner_person_id);
create index transaction_items_user_idx on public.transaction_items (user_id);

create index transactions_account_idx on public.transactions (account_id);
create index transactions_category_idx on public.transactions (category_id);
