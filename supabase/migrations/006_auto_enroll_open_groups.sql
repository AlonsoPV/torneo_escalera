-- Inscripción automática: al crearse un perfil de jugador, se inscribe en el primer
-- grupo con plazas de cada torneo `active` (orden: groups.order_index, id).
-- Un solo grupo por torneo; respeta max_players (migración 004) y triggers existentes.
-- Errores no impiden el alta (función de trigger engloba en excepción).

-- ---------------------------------------------------------------------------
create or replace function public.enroll_user_in_open_groups(
  p_user_id uuid,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  gid uuid;
  next_seed int;
  dname text;
  headcount int;
  cap int;
begin
  dname := nullif(trim(coalesce(p_display_name, '')), '');
  if dname is null or dname = '' then
    dname := 'Jugador';
  end if;

  for t in
    select id
    from public.tournaments
    where status = 'active'
  loop
    if exists (
      select 1
      from public.group_players gp
      join public.groups g on g.id = gp.group_id
      where g.tournament_id = t.id
        and gp.user_id = p_user_id
    ) then
      continue;
    end if;

    select g.id
    into gid
    from public.groups g
    where g.tournament_id = t.id
      and (
        select count(*)::int
        from public.group_players gp2
        where gp2.group_id = g.id
      ) < coalesce(g.max_players, 5)
    order by g.order_index, g.id
    limit 1;

    if gid is null then
      continue;
    end if;

    select coalesce(max(seed_order), 0) + 1
    into next_seed
    from public.group_players
    where group_id = gid;

    insert into public.group_players (group_id, user_id, display_name, seed_order)
    values (gid, p_user_id, dname, next_seed);
  end loop;
end;
$$;

create or replace function public.profiles_after_insert_auto_enroll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from 'player' then
    return new;
  end if;
  begin
    perform public.enroll_user_in_open_groups(
      new.id,
      coalesce(
        new.full_name,
        split_part(new.email, '@', 1),
        'Jugador'
      )
    );
  exception
    when others then
      raise warning 'enroll_user_in_open_groups( % ): %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_profiles_auto_enroll_open_groups on public.profiles;
create trigger trg_profiles_auto_enroll_open_groups
  after insert on public.profiles
  for each row
  execute function public.profiles_after_insert_auto_enroll();

comment on function public.enroll_user_in_open_groups is
  'Añade el usuario al primer grupo con plazas de cada torneo activo (público: solo vía trigger).';
