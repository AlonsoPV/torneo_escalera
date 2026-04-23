-- Ventana de marcador para jugadores: si no hay scheduled_end_at, se considera abierta
-- (útil mientras no se agenda en serio). Si hay fin agendado, sigue aplicando que ya haya pasado.

create or replace function public.match_time_window_ok(m public.matches)
returns boolean
language sql
stable
as $$
  select m.scheduled_end_at is null or m.scheduled_end_at < now();
$$;

create or replace function public.match_ready_for_result(m public.matches)
returns boolean
language sql
stable
as $$
  select
    (m.scheduled_end_at is null or m.scheduled_end_at < now())
    and m.status in ('pending', 'scheduled', 'ready_for_result');
$$;

create or replace function public.submit_player_match_result(
  p_match_id uuid,
  p_score jsonb,
  p_result_type text default 'normal',
  p_winner_group_player_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  uid uuid := auth.uid();
  is_resubmit boolean;
  log_action text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Partido no encontrado';
  end if;

  if m.player_a_user_id <> uid and m.player_b_user_id <> uid then
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

  if m.status in ('confirmed', 'corrected', 'cancelled') then
    raise exception 'El partido no admite envío de jugador en este estado';
  end if;

  is_resubmit := (m.status = 'result_submitted');

  if p_result_type = 'normal' and (
    p_winner_group_player_id is null
    or p_winner_group_player_id not in (m.player_a_id, m.player_b_id)
  ) then
    raise exception 'Indica el ganador del partido (jugador A o B del grupo)';
  end if;

  if p_result_type = 'normal' then
    if p_score is null or jsonb_array_length(p_score) = 0 then
      raise exception 'Indica el marcador por sets';
    end if;
    if m.scheduled_end_at is not null and m.scheduled_end_at >= now() then
      raise exception 'Aún no puedes registrar el resultado (debe pasar la hora de fin)';
    end if;
    perform public.validate_match_score_against_tournament_rules(
      m.tournament_id,
      p_score,
      p_winner_group_player_id,
      m.player_a_id,
      m.player_b_id
    );
  end if;

  if m.status not in ('pending', 'scheduled', 'ready_for_result', 'result_submitted') then
    raise exception 'Estado de partido no válido para envío';
  end if;

  if not is_resubmit then
    log_action := 'player_submit';
  else
    log_action := 'player_resubmit';
  end if;

  update public.matches
  set
    score_raw = case when p_result_type = 'normal' then p_score else score_raw end,
    winner_id = case when p_result_type = 'normal' then p_winner_group_player_id else winner_id end,
    result_type = coalesce(nullif(p_result_type, ''), 'normal'),
    status = 'result_submitted',
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
    'result_submitted',
    uid,
    m.status
  );
end;
$$;
