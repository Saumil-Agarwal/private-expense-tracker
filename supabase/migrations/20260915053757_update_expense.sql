create or replace function public.update_expense(
  p_transaction_id uuid,
  p_user_id uuid,
  p_expense jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_category_id uuid;
  v_selected_group_id uuid;
  v_owner_person_id uuid;
  allocation jsonb;
  item jsonb;
  v_resolved_person_id uuid;
  v_updated_id uuid;
begin
  if not exists (
    select 1 from public.transactions
    where id = p_transaction_id and user_id = p_user_id and deleted_at is null
  ) then
    return null;
  end if;

  if nullif(btrim(p_expense->>'category'), '') is not null then
    insert into public.categories (user_id, name)
    values (p_user_id, btrim(p_expense->>'category'))
    on conflict (user_id, name) do update set name = excluded.name
    returning id into v_category_id;
  end if;

  v_selected_group_id := nullif(p_expense->>'groupId', '')::uuid;
  if v_selected_group_id is not null and not exists (
    select 1 from public.groups where id = v_selected_group_id and user_id = p_user_id
  ) then
    raise exception 'Expense group not found';
  end if;

  update public.transactions set
    merchant = btrim(p_expense->>'merchant'),
    amount_paise = (p_expense->>'amountPaise')::bigint,
    currency = p_expense->>'currency',
    occurred_on = (p_expense->>'date')::date,
    category_id = v_category_id,
    group_id = v_selected_group_id,
    status = p_expense->>'status',
    notes = nullif(btrim(p_expense->>'notes'), ''),
    source = p_expense->>'source',
    updated_at = now()
  where id = p_transaction_id and user_id = p_user_id and deleted_at is null
  returning id into v_updated_id;

  delete from public.allocations where transaction_id = p_transaction_id and user_id = p_user_id;
  delete from public.transaction_items where transaction_id = p_transaction_id and user_id = p_user_id;

  for allocation in select value from jsonb_array_elements(coalesce(p_expense->'allocations', '[]'::jsonb)) loop
    if allocation->>'personId' = 'me' then
      insert into public.people (user_id, name, is_owner)
      values (p_user_id, 'Me', true)
      on conflict (user_id, name) do update set is_owner = true
      returning id into v_resolved_person_id;
      v_owner_person_id := v_resolved_person_id;
    elsif allocation->>'personId' like 'name:%' then
      insert into public.people (user_id, name)
      values (p_user_id, btrim(substr(allocation->>'personId', 6)))
      on conflict (user_id, name) do update set name = excluded.name
      returning id into v_resolved_person_id;
    else
      select id into v_resolved_person_id from public.people
      where id = (allocation->>'personId')::uuid and user_id = p_user_id;
      if v_resolved_person_id is null then raise exception 'Expense participant not found'; end if;
      if exists (select 1 from public.people where id = v_resolved_person_id and is_owner) then v_owner_person_id := v_resolved_person_id; end if;
    end if;

    insert into public.allocations (user_id, transaction_id, person_id, amount_paise)
    values (p_user_id, p_transaction_id, v_resolved_person_id, (allocation->>'amountPaise')::bigint);
  end loop;

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_expense->'items', '[]'::jsonb)) value
    where coalesce((value->>'personal')::boolean, false)
  ) and v_owner_person_id is null then
    insert into public.people (user_id, name, is_owner)
    values (p_user_id, 'Me', true)
    on conflict (user_id, name) do update set is_owner = true
    returning id into v_owner_person_id;
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_expense->'items', '[]'::jsonb)) loop
    insert into public.transaction_items (user_id, transaction_id, name, quantity, amount_paise, owner_person_id)
    values (
      p_user_id, p_transaction_id, btrim(item->>'name'), (item->>'quantity')::numeric,
      (item->>'amountPaise')::bigint,
      case when coalesce((item->>'personal')::boolean, false) then v_owner_person_id else null end
    );
  end loop;

  return v_updated_id;
end;
$$;

revoke all on function public.update_expense(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_expense(uuid, uuid, jsonb) to service_role;
