create table public.payment_source_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_key text not null check (source_key in ('cash', 'axis-7461', 'axis-1177', 'axis-my-zone', 'axis-select', 'icici-amazon', 'icici-sapphiro', 'splitwise', 'amazon-pay', 'uber-points')),
  entered_through date,
  updated_at timestamptz not null default now(),
  unique (user_id, source_key)
);

create table public.participant_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  informed_at timestamptz not null default now(),
  unique (user_id, person_id)
);

create index participant_notifications_user_idx on public.participant_notifications (user_id, informed_at);

alter table public.payment_source_progress enable row level security;
alter table public.participant_notifications enable row level security;

revoke all on public.payment_source_progress, public.participant_notifications from anon;
revoke all on public.payment_source_progress, public.participant_notifications from authenticated;
grant select, insert, update, delete on public.payment_source_progress, public.participant_notifications to authenticated;

create policy "payment_source_progress_select_own" on public.payment_source_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "payment_source_progress_insert_own" on public.payment_source_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "payment_source_progress_update_own" on public.payment_source_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "payment_source_progress_delete_own" on public.payment_source_progress for delete to authenticated using ((select auth.uid()) = user_id);

create policy "participant_notifications_select_own" on public.participant_notifications for select to authenticated using ((select auth.uid()) = user_id);
create policy "participant_notifications_insert_own" on public.participant_notifications for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "participant_notifications_update_own" on public.participant_notifications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "participant_notifications_delete_own" on public.participant_notifications for delete to authenticated using ((select auth.uid()) = user_id);
