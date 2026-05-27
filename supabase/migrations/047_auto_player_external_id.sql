create or replace function public.assign_next_player_external_id(
  p_user_id uuid,
  p_min_external_id integer default 95
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing text;
  v_next integer;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('profiles:player_external_id'));

  select nullif(trim(external_id), '')
    into v_existing
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile % not found', p_user_id;
  end if;

  if v_existing is not null then
    return v_existing;
  end if;

  select greatest(
    coalesce(max(trim(external_id)::integer) + 1, p_min_external_id),
    p_min_external_id
  )
    into v_next
  from public.profiles
  where nullif(trim(external_id), '') is not null
    and trim(external_id) ~ '^[0-9]{1,6}$';

  update public.profiles
  set external_id = v_next::text
  where id = p_user_id
  returning external_id into v_existing;

  return v_existing;
end;
$$;

revoke all on function public.assign_next_player_external_id(uuid, integer) from public;
revoke all on function public.assign_next_player_external_id(uuid, integer) from anon;
revoke all on function public.assign_next_player_external_id(uuid, integer) from authenticated;
grant execute on function public.assign_next_player_external_id(uuid, integer) to service_role;
