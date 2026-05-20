-- Notificaciones para staff cuando un jugador registra resultado provisional (score_submitted).

create table if not exists public.staff_match_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  match_id uuid not null references public.matches(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  event_type text not null check (event_type in ('player_score_submitted')),
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists staff_match_notifications_created_at_idx
  on public.staff_match_notifications (created_at desc);

comment on table public.staff_match_notifications is
  'Avisos para administradores ante envíos de marcador por jugadores (solo lectura desde la app; INSERT vía trigger).';

alter table public.staff_match_notifications enable row level security;

create policy staff_match_notifications_select_admin
  on public.staff_match_notifications
  for select
  to authenticated
  using (public.is_admin());

create or replace function public.notify_staff_on_player_score_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gname text;
  v_tname text;
  v_pa text;
  v_pb text;
  v_submitter text;
  v_body text;
  v_meta jsonb;
  i int;
  el jsonb;
  parts text[] := array[]::text[];
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status is distinct from 'score_submitted' then
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  if old.status not in ('pending_score', 'score_disputed') then
    return new;
  end if;

  if new.score_submitted_by is null then
    return new;
  end if;

  select g.name, t.name
    into v_gname, v_tname
  from public.groups g
  join public.tournaments t on t.id = g.tournament_id
  where g.id = new.group_id;

  select coalesce(max(case when gp.id = new.player_a_id then gp.display_name end), 'Jugador A'),
         coalesce(max(case when gp.id = new.player_b_id then gp.display_name end), 'Jugador B')
    into v_pa, v_pb
  from public.group_players gp
  where gp.id in (new.player_a_id, new.player_b_id);

  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Jugador')
    into v_submitter
  from public.profiles p
  where p.id = new.score_submitted_by;

  if new.score_raw is not null
     and jsonb_typeof(new.score_raw) = 'array'
     and jsonb_array_length(new.score_raw) > 0
  then
    for i in 0..jsonb_array_length(new.score_raw) - 1 loop
      el := new.score_raw -> i;
      parts := parts || (coalesce(el ->> 'a', '?') || '-' || coalesce(el ->> 'b', '?'));
    end loop;
  end if;

  v_body := format(
    'Torneo: %s · Grupo: %s · %s vs %s · Marcador: %s · Registró: %s (pendiente confirmación del rival; puedes corregir desde administración).',
    coalesce(v_tname, '—'),
    coalesce(v_gname, '—'),
    coalesce(v_pa, 'A'),
    coalesce(v_pb, 'B'),
    case when cardinality(parts) > 0 then array_to_string(parts, ' · ') else '—' end,
    coalesce(v_submitter, '—')
  );

  v_meta := jsonb_build_object(
    'match_id', new.id,
    'tournament_id', new.tournament_id,
    'group_id', new.group_id,
    'tournament_name', v_tname,
    'group_name', v_gname,
    'player_a_name', v_pa,
    'player_b_name', v_pb,
    'score_raw', new.score_raw,
    'score_submitted_by', new.score_submitted_by,
    'previous_status', old.status
  );

  insert into public.staff_match_notifications (
    match_id,
    tournament_id,
    group_id,
    event_type,
    title,
    body,
    metadata
  ) values (
    new.id,
    new.tournament_id,
    new.group_id,
    'player_score_submitted',
    'Resultado provisional registrado por jugador',
    v_body,
    coalesce(v_meta, '{}'::jsonb)
  );

  return new;
end;
$$;

drop trigger if exists matches_notify_staff_score_submitted on public.matches;

create trigger matches_notify_staff_score_submitted
  after update of status on public.matches
  for each row
  execute function public.notify_staff_on_player_score_submitted();
