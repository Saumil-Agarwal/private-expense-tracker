begin;

lock table public.profiles in exclusive mode;

do $$
declare
  profile_count bigint;
begin
  select count(*) into profile_count from public.profiles;
  if profile_count > 1 then
    raise exception 'Local-only migration requires at most one profile; found %', profile_count;
  end if;
end
$$;

alter table public.profiles add column profile_key text;
update public.profiles set profile_key = 'local-owner';
alter table public.profiles alter column profile_key set not null;
alter table public.profiles add constraint profiles_profile_key_key unique (profile_key);
alter table public.profiles drop column telegram_user_id;

drop table public.telegram_updates;

alter table public.transactions drop constraint if exists transactions_source_check;
update public.transactions set source = 'manual' where source = 'telegram';
alter table public.transactions add constraint transactions_source_check
  check (source in ('manual', 'receipt', 'ollama', 'on_device_model'));

commit;
