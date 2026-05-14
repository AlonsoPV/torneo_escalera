-- Cualquier participante del partido puede enviar o corregir el marcador.
-- Quien envía queda en `score_submitted_by`; el otro debe aceptar/rechazar.
-- Los marcadores se siguen guardando en perspectiva canónica (player_a / player_b).

create or replace function public.submit_player_match_result(
  p_match_id uuid,
  p_score jsonb,
  p_result_type text default 'normal',
  p_winner_group_player_id uuid default null,
  p_game_type text default 'best_of_3'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  uid uuid := auth.uid();
  log_action text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Partido no encontrado';
  end if;

  if uid <> m.player_a_user_id and uid <> m.player_b_user_id then
    raise exception 'No participas en este partido';
  end if;

  if not exists (
    select 1 from public.tournament_rules r2
    where r2.tournament_id = m.tournament_id
      and r2.allow_player_score_entry = true
  ) then
    raise exception 'La captura de marcador por jugadores no está habilitada para este torneo';
  end if;

  if public.is_admin() then
    raise exception 'Usa el flujo de administrador para editar';
  end if;

  if m.status in ('score_submitted', 'player_confirmed', 'closed', 'cancelled') then
    raise exception 'No puedes editar el marcador en este estado';
  end if;

  if m.status not in ('pending_score', 'score_disputed') then
    raise exception 'Estado de partido no válido para envío';
  end if;

  if p_result_type = 'normal' and (
    p_winner_group_player_id is null
    or p_winner_group_player_id not in (m.player_a_id, m.player_b_id)
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
      m.tournament_id,
      p_score,
      p_winner_group_player_id,
      m.player_a_id,
      m.player_b_id
    );
  end if;

  log_action := case
    when m.status = 'score_disputed' then 'player_resubmit_after_dispute'
    when uid = m.player_b_user_id then 'player_b_submit'
    else 'player_a_submit'
  end;

  update public.matches
  set
    score_raw = case when p_result_type = 'normal' then p_score else score_raw end,
    winner_id = case when p_result_type = 'normal' then p_winner_group_player_id else winner_id end,
    game_type = coalesce(nullif(p_game_type, ''), 'best_of_3'),
    result_type = coalesce(nullif(p_result_type, ''), 'normal'),
    status = 'score_submitted',
    score_submitted_by = uid,
    score_submitted_at = now(),
    opponent_confirmed_by = null,
    opponent_confirmed_at = null,
    dispute_reason = null,
    updated_by = uid,
    updated_at = now(),
    locked_at = coalesce(locked_at, now())
  where id = p_match_id;

  insert into public.match_score_logs (
    match_id, action_type, previous_score_json, new_score_json, new_status, changed_by, previous_status
  ) values (
    p_match_id,
    log_action,
    m.score_raw,
    p_score,
    'score_submitted',
    uid,
    m.status
  );
end;
$$;

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

  if m.status <> 'score_submitted' then
    raise exception 'No hay un marcador pendiente de tu revisión';
  end if;

  if uid <> m.player_a_user_id and uid <> m.player_b_user_id then
    raise exception 'No participas en este partido';
  end if;

  if m.score_submitted_by is not null then
    if uid = m.score_submitted_by then
      raise exception 'No puedes revisar tu propio envío';
    end if;
  else
    -- Compatibilidad: envíos antiguos sin firma; se asumía envío por Jugador A canónico.
    if uid <> m.player_b_user_id then
      raise exception 'Solo el segundo jugador del cruce puede aceptar o rechazar el marcador';
    end if;
  end if;

  if p_accept then
    update public.matches
    set
      status = 'player_confirmed',
      opponent_confirmed_by = uid,
      opponent_confirmed_at = now(),
      updated_by = uid,
      updated_at = now()
    where id = p_match_id;

    insert into public.match_score_logs (
      match_id, action_type, previous_score_json, new_score_json, new_status, changed_by, previous_status
    ) values (
      p_match_id,
      'opponent_accept',
      m.score_raw,
      m.score_raw,
      'player_confirmed',
      uid,
      m.status
    );
  else
    if p_dispute_reason is null or length(trim(p_dispute_reason)) < 3 then
      raise exception 'Escribe un motivo de rechazo (mín. 3 caracteres)';
    end if;

    update public.matches
    set
      status = 'score_disputed',
      dispute_reason = trim(p_dispute_reason),
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
  end if;
end;
$$;

grant execute on function public.submit_player_match_result(uuid, jsonb, text, uuid, text) to authenticated;
grant execute on function public.opponent_respond_match_score(uuid, boolean, text) to authenticated;
