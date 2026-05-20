-- Jugador: envío de marcador → closed (oficial al instante); rival solo refuta → score_disputed.
-- Migración legacy score_submitted/player_confirmed → closed; índices; notificación staff en closed.

create index if not exists idx_matches_group_id_status on public.matches (group_id, status);
create index if not exists idx_matches_tournament_id_group_id on public.matches (tournament_id, group_id);

-- Normaliza filas intermedias previas (happy path ya no las usa).
update public.matches m
set
  status = 'closed',
  closed_at = coalesce(m.closed_at, m.score_submitted_at, m.updated_at, now())
where m.status in ('score_submitted', 'player_confirmed');

alter table public.staff_match_notifications
  drop constraint if exists staff_match_notifications_event_type_check;

alter table public.staff_match_notifications
  add constraint staff_match_notifications_event_type_check
  check (event_type in ('player_score_submitted', 'player_match_closed'));

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
  v_event text;
  v_title text;
  i int;
  el jsonb;
  parts text[] := array[]::text[];
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.score_submitted_by is null then
    return new;
  end if;

  if new.status = 'closed'
     and old.status is distinct from 'closed'
     and old.status in ('pending_score', 'score_disputed')
  then
    v_event := 'player_match_closed';
    v_title := 'Resultado oficial registrado por jugador';
  elsif new.status = 'score_submitted'
        and old.status is distinct from 'score_submitted'
        and old.status in ('pending_score', 'score_disputed')
  then
    -- Compatibilidad si quedara código legacy en otro entorno.
    v_event := 'player_score_submitted';
    v_title := 'Resultado provisional registrado por jugador';
  else
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

  if v_event = 'player_match_closed' then
    v_body := format(
      'Torneo: %s · Grupo: %s · %s vs %s · Marcador: %s · Registró: %s (oficial para tabla; el rival solo puede refutar desde la app).',
      coalesce(v_tname, '—'),
      coalesce(v_gname, '—'),
      coalesce(v_pa, 'A'),
      coalesce(v_pb, 'B'),
      case when cardinality(parts) > 0 then array_to_string(parts, ' · ') else '—' end,
      coalesce(v_submitter, '—')
    );
  else
    v_body := format(
      'Torneo: %s · Grupo: %s · %s vs %s · Marcador: %s · Registró: %s (pendiente confirmación del rival; puedes corregir desde administración).',
      coalesce(v_tname, '—'),
      coalesce(v_gname, '—'),
      coalesce(v_pa, 'A'),
      coalesce(v_pb, 'B'),
      case when cardinality(parts) > 0 then array_to_string(parts, ' · ') else '—' end,
      coalesce(v_submitter, '—')
    );
  end if;

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
    v_event,
    v_title,
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

drop function if exists public.submit_player_match_result(uuid, jsonb, text, uuid, text);

create function public.submit_player_match_result(
  p_match_id uuid,
  p_score jsonb,
  p_result_type text default 'normal',
  p_winner_group_player_id uuid default null,
  p_game_type text default 'best_of_3'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m_old public.matches%rowtype;
  m_row public.matches%rowtype;
  uid uuid := auth.uid();
  log_action text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into m_old from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Partido no encontrado';
  end if;

  if uid <> m_old.player_a_user_id and uid <> m_old.player_b_user_id then
    raise exception 'No participas en este partido';
  end if;

  if not exists (
    select 1 from public.tournament_rules r2
    where r2.tournament_id = m_old.tournament_id
      and r2.allow_player_score_entry = true
  ) then
    raise exception 'La captura de marcador por jugadores no está habilitada para este torneo';
  end if;

  if public.is_admin() then
    raise exception 'Usa el flujo de administrador para editar';
  end if;

  if m_old.status in ('closed', 'cancelled') then
    raise exception 'No puedes editar el marcador en este estado';
  end if;

  if m_old.status not in ('pending_score', 'score_disputed') then
    raise exception 'Estado de partido no válido para envío';
  end if;

  if p_result_type = 'normal' and (
    p_winner_group_player_id is null
    or p_winner_group_player_id not in (m_old.player_a_id, m_old.player_b_id)
  ) then
    raise exception 'Indica el ganador del partido (jugador A o B del grupo)';
  end if;

  if p_game_type not in ('best_of_3', 'sudden_death', 'long_set') then
    raise exception 'Tipo de juego inválido';
  end if;

  if p_result_type = 'normal' and p_game_type = 'best_of_3' then
    if p_score is null or jsonb_array_length(p_score) = 0 then
      raise exception 'Indica el marcador por sets';
    end if;
    perform public.validate_match_score_against_tournament_rules(
      m_old.tournament_id,
      p_score,
      p_winner_group_player_id,
      m_old.player_a_id,
      m_old.player_b_id
    );
  end if;

  if p_result_type = 'normal' and p_game_type = 'sudden_death' then
    if p_score is null or jsonb_typeof(p_score) <> 'array' or jsonb_array_length(p_score) <> 3 then
      raise exception 'Muerte súbita: indica exactamente 3 sets';
    end if;
    perform public.validate_sudden_death_three_set_score(
      m_old.tournament_id,
      p_score,
      p_winner_group_player_id,
      m_old.player_a_id,
      m_old.player_b_id
    );
  end if;

  log_action := case
    when m_old.status = 'score_disputed' then 'player_resubmit_after_dispute'
    when uid = m_old.player_b_user_id then 'player_b_submit'
    else 'player_a_submit'
  end;

  update public.matches
  set
    score_raw = case when p_result_type = 'normal' then p_score else score_raw end,
    winner_id = case when p_result_type = 'normal' then p_winner_group_player_id else winner_id end,
    game_type = coalesce(nullif(p_game_type, ''), 'best_of_3'),
    result_type = coalesce(nullif(p_result_type, ''), 'normal'),
    status = 'closed',
    score_submitted_by = uid,
    score_submitted_at = now(),
    opponent_confirmed_by = null,
    opponent_confirmed_at = null,
    dispute_reason = null,
    updated_by = uid,
    updated_at = now(),
    locked_at = coalesce(locked_at, now()),
    closed_at = now(),
    admin_validated_by = null,
    admin_validated_at = null,
    confirmed_at = coalesce(confirmed_at, now()),
    confirmed_by = coalesce(confirmed_by, uid)
  where id = p_match_id
  returning * into m_row;

  insert into public.match_score_logs (
    match_id, action_type, previous_score_json, new_score_json, new_status, changed_by, previous_status
  ) values (
    p_match_id,
    log_action,
    m_old.score_raw,
    p_score,
    'closed',
    uid,
    m_old.status
  );

  return to_jsonb(m_row);
end;
$$;

grant execute on function public.submit_player_match_result(uuid, jsonb, text, uuid, text) to authenticated;

create or replace function public.opponent_respond_match_score(
  p_match_id uuid,
  p_accept boolean,
  p_dispute_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Partido no encontrado';
  end if;

  if public.is_admin() then
    raise exception 'Usa el flujo de administrador';
  end if;

  if p_accept then
    raise exception 'La confirmación del rival ya no está disponible; el marcador es oficial al registrarse.';
  end if;

  if m.status not in ('closed', 'score_submitted') then
    raise exception 'No puedes refutar este marcador en el estado actual';
  end if;

  if uid <> m.player_a_user_id and uid <> m.player_b_user_id then
    raise exception 'No participas en este partido';
  end if;

  if m.score_submitted_by is not null then
    if uid = m.score_submitted_by then
      raise exception 'No puedes refutar tu propio envío';
    end if;
  else
    if uid <> m.player_b_user_id then
      raise exception 'Solo el segundo jugador del cruce puede refutar este marcador';
    end if;
  end if;

  if p_dispute_reason is null or length(trim(p_dispute_reason)) < 3 then
    raise exception 'Escribe un motivo de rechazo (mín. 3 caracteres)';
  end if;

  update public.matches
  set
    status = 'score_disputed',
    dispute_reason = trim(p_dispute_reason),
    closed_at = null,
    admin_validated_by = null,
    admin_validated_at = null,
    updated_by = uid,
    updated_at = now()
  where id = p_match_id;

  insert into public.match_score_logs (
    match_id, action_type, previous_score_json, new_score_json, new_status, changed_by, previous_status
  ) values (
    p_match_id,
    'opponent_reject',
    m.score_raw,
    m.score_raw,
    'score_disputed',
    uid,
    m.status
  );
end;
$$;

grant execute on function public.opponent_respond_match_score(uuid, boolean, text) to authenticated;
