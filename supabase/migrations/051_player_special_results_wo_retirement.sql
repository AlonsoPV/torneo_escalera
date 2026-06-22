-- Player score submission: allow W.O. and retirement for best-of-3 and sudden death.

create or replace function public.submit_player_match_result(
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
set lock_timeout = '5s'
set statement_timeout = '20s'
as $$
declare
  m_old public.matches%rowtype;
  m_row public.matches%rowtype;
  uid uuid := auth.uid();
  log_action text;
  v_result_type text := coalesce(nullif(p_result_type, ''), 'normal');
  v_game_type text := coalesce(nullif(p_game_type, ''), 'best_of_3');
  v_a_games integer := 0;
  v_b_games integer := 0;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  begin
    select * into m_old from public.matches where id = p_match_id for update nowait;
  exception
    when lock_not_available then
      raise exception 'El partido se esta actualizando en este momento. Espera unos segundos e intenta enviar el marcador de nuevo.';
  end;

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
    raise exception 'La captura de marcador por jugadores no esta habilitada para este torneo';
  end if;

  if public.is_admin() then
    raise exception 'Usa el flujo de administrador para editar';
  end if;

  if m_old.status in ('closed', 'validated', 'cancelled') then
    raise exception 'No puedes editar el marcador en este estado';
  end if;

  if m_old.status <> 'pending_score' then
    raise exception 'Solo puedes registrar marcador desde pendiente de marcador; si hubo disputa, contacta a organizacion.';
  end if;

  if v_result_type not in ('normal', 'not_reported', 'retired', 'retired_draw', 'wo') then
    raise exception 'Tipo de resultado invalido para envio de jugador';
  end if;

  if v_game_type not in ('best_of_3', 'sudden_death', 'long_set', 'best_of_3_short_tiebreak') then
    raise exception 'Tipo de juego invalido';
  end if;

  if v_result_type in ('normal', 'wo') and (
    p_winner_group_player_id is null
    or p_winner_group_player_id not in (m_old.player_a_id, m_old.player_b_id)
  ) then
    raise exception 'Indica el ganador del partido (jugador A o B del grupo)';
  end if;

  if v_result_type in ('retired', 'retired_draw') then
    if v_game_type not in ('best_of_3', 'sudden_death') then
      raise exception 'El retiro solo aplica para partidos 2 de 3 sets o muerte subita';
    end if;

    if v_game_type = 'best_of_3' then
      if p_score is null or jsonb_typeof(p_score) <> 'array' or jsonb_array_length(p_score) = 0 or jsonb_array_length(p_score) > 3 then
        raise exception 'Retiro: indica entre 1 y 3 sets jugados';
      end if;
      if exists (
        select 1
        from jsonb_array_elements(p_score) as s(value)
        where jsonb_typeof(value->'a') is distinct from 'number'
           or jsonb_typeof(value->'b') is distinct from 'number'
           or (value->>'a')::numeric < 0
           or (value->>'b')::numeric < 0
           or (value->>'a')::numeric <> trunc((value->>'a')::numeric)
           or (value->>'b')::numeric <> trunc((value->>'b')::numeric)
      ) then
        raise exception 'Retiro: los games deben ser enteros mayores o iguales a 0';
      end if;

      select
        coalesce(sum((value->>'a')::integer), 0),
        coalesce(sum((value->>'b')::integer), 0)
      into v_a_games, v_b_games
      from jsonb_array_elements(p_score) as s(value);

      if v_a_games + v_b_games <= 0 then
        raise exception 'Retiro: debe existir al menos un game jugado';
      end if;
    end if;

    if v_result_type = 'retired' and (
      p_winner_group_player_id is null
      or p_winner_group_player_id not in (m_old.player_a_id, m_old.player_b_id)
    ) then
      raise exception 'Retiro: indica el ganador';
    end if;
  end if;

  if v_result_type = 'normal' and v_game_type = 'best_of_3' then
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

  if v_result_type = 'normal' and v_game_type = 'sudden_death' then
    if p_score is null or jsonb_typeof(p_score) <> 'array' or jsonb_array_length(p_score) <> 3 then
      raise exception 'Muerte subita: indica exactamente 3 sets';
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
    when uid = m_old.player_b_user_id then 'player_b_submit'
    else 'player_a_submit'
  end;

  update public.matches
  set
    score_raw = case
      when v_result_type in ('not_reported', 'wo') then null
      else p_score
    end,
    winner_id = case
      when v_result_type in ('not_reported', 'retired_draw') then null
      else p_winner_group_player_id
    end,
    game_type = v_game_type,
    result_type = v_result_type,
    status = 'closed',
    score_submitted_by = uid,
    score_submitted_at = now(),
    opponent_confirmed_by = null,
    opponent_confirmed_at = null,
    dispute_reason = null,
    disputed_by = null,
    disputed_at = null,
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
    case when v_result_type in ('not_reported', 'wo') then null else p_score end,
    'closed',
    uid,
    m_old.status
  );

  return to_jsonb(m_row);
end;
$$;

grant execute on function public.submit_player_match_result(uuid, jsonb, text, uuid, text) to authenticated;
