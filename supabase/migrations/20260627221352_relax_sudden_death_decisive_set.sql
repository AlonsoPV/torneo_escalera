-- Relax decisive sudden-death set: no longer force 1-0.
-- Any non-negative integer score with no tie defines the winner.

create or replace function public.validate_match_score_against_tournament_rules(
  p_tournament_id uuid,
  p_score jsonb,
  p_winner_group_player_id uuid,
  p_player_a_id uuid,
  p_player_b_id uuid
)
returns void
language plpgsql
stable
as $$
declare
  v_best_of int;
  games_i int;
  max_sets int;
  need int;
  n int;
  i int;
  a int;
  b int;
  a_wins int := 0;
  b_wins int := 0;
  winner uuid;
  deciding boolean;
  use_short boolean;
  final_fmt text;
  short_ok boolean;
  classic_ok boolean;
begin
  if p_score is null or jsonb_typeof(p_score) <> 'array' or jsonb_array_length(p_score) = 0 then
    raise exception 'Indica el marcador por sets';
  end if;

  select
    tr.best_of_sets,
    coalesce(nullif(tr.games_per_set, 0), tr.set_points, 6),
    coalesce(tr.final_set_format, case when tr.super_tiebreak_final_set then 'super_tiebreak' else 'sudden_death' end)
  into strict v_best_of, games_i, final_fmt
  from public.tournament_rules tr
  where tr.tournament_id = p_tournament_id;

  games_i := greatest(games_i, 1);
  max_sets := v_best_of;
  need := floor(max_sets::float / 2.0)::int + 1;

  n := jsonb_array_length(p_score);
  if n > max_sets then
    raise exception 'Maximo % sets segun el torneo', max_sets;
  end if;

  for i in 0..(n - 1) loop
    a := (jsonb_array_element(p_score, i)->>'a')::int;
    b := (jsonb_array_element(p_score, i)->>'b')::int;
    if a is null or b is null then
      raise exception 'Cada set debe tener valores a y b';
    end if;
    if a < 0 or b < 0 then
      raise exception 'Los valores no pueden ser negativos';
    end if;
    if a = b then
      raise exception 'Un set no puede terminar empatado';
    end if;

    deciding := (need > 1 and a_wins = need - 1 and b_wins = need - 1);
    use_short := deciding and final_fmt in ('sudden_death', 'super_tiebreak');

    if use_short then
      short_ok := true;
      classic_ok := games_i = 6 and public.is_valid_classic_six_game_set(a, b);
      if not (short_ok or classic_ok) then
        raise exception 'Set decisivo invalido';
      end if;
    elsif games_i = 6 then
      if not public.is_valid_classic_six_game_set(a, b) then
        raise exception 'Set invalido: use 6-0..6-4, 7-5 o 7-6 (tie-break como 7-6)';
      end if;
    end if;

    if a > b then
      a_wins := a_wins + 1;
    else
      b_wins := b_wins + 1;
    end if;
  end loop;

  if a_wins < need and b_wins < need then
    raise exception 'El marcador no define un ganador segun el formato del torneo';
  end if;

  if a_wins >= need then
    winner := p_player_a_id;
  else
    winner := p_player_b_id;
  end if;

  if p_winner_group_player_id is distinct from winner then
    raise exception 'El ganador no coincide con el marcador (sets)';
  end if;
end;
$$;

create or replace function public.validate_sudden_death_three_set_score(
  p_tournament_id uuid,
  p_score jsonb,
  p_winner_group_player_id uuid,
  p_player_a_id uuid,
  p_player_b_id uuid
)
returns void
language plpgsql
stable
as $$
declare
  n int;
  games_i int;
  tb_en boolean;
  i int;
  a int;
  b int;
  mx int;
  mi int;
  is_std boolean;
  is_tb boolean;
  min_diff int;
  tb_at int;
  winner uuid;
begin
  if p_score is null or jsonb_typeof(p_score) <> 'array' then
    raise exception 'Indica el marcador por sets';
  end if;

  n := jsonb_array_length(p_score);
  if n not in (1, 3) then
    raise exception 'La muerte subita debe capturar el set decisivo o los 3 sets historicos';
  end if;

  if n = 1 then
    a := (jsonb_array_element(p_score, 0)->>'a')::int;
    b := (jsonb_array_element(p_score, 0)->>'b')::int;
    if a is null or b is null then
      raise exception 'El set decisivo debe tener valores a y b';
    end if;
    if a < 0 or b < 0 then
      raise exception 'Los valores del set decisivo no pueden ser negativos';
    end if;
    if a = b then
      raise exception 'El set decisivo de muerte subita no puede terminar empatado';
    end if;

    if a > b then
      winner := p_player_a_id;
    else
      winner := p_player_b_id;
    end if;

    if p_winner_group_player_id is distinct from winner then
      raise exception 'El ganador no coincide con el set decisivo';
    end if;

    return;
  end if;

  select
    tr.tiebreak_enabled,
    coalesce(tr.games_per_set, tr.set_points),
    coalesce(tr.min_game_difference, 2),
    tr.tiebreak_at
  into strict tb_en, games_i, min_diff, tb_at
  from public.tournament_rules tr
  where tr.tournament_id = p_tournament_id;

  games_i := greatest(games_i, 1);
  min_diff := greatest(min_diff, 1);

  for i in 0..1 loop
    a := (jsonb_array_element(p_score, i)->>'a')::int;
    b := (jsonb_array_element(p_score, i)->>'b')::int;
    if a is null or b is null then
      raise exception 'Cada set debe tener valores a y b';
    end if;
    if a < 0 or b < 0 then
      raise exception 'Los valores no pueden ser negativos';
    end if;
    if a = b then
      raise exception 'Un set no puede terminar empatado';
    end if;

    mx := greatest(a, b);
    mi := least(a, b);
    is_std := (mx = games_i and (mx - mi) >= min_diff);
    if tb_en and tb_at is not null and tb_at = 5 then
      is_tb := (mx = games_i + 1 and mi = games_i - 1);
    elsif tb_en then
      is_tb := (mx = games_i + 1 and mi = games_i);
    else
      is_tb := false;
    end if;
    if mx > games_i and not is_std and not is_tb then
      raise exception 'Set invalido para jugar a % games (diferencia min. %, tie-break segun reglas).',
        games_i, min_diff;
    end if;
  end loop;

  a := (jsonb_array_element(p_score, 2)->>'a')::int;
  b := (jsonb_array_element(p_score, 2)->>'b')::int;
  if a is null or b is null then
    raise exception 'El tercer set debe tener valores a y b';
  end if;
  if a < 0 or b < 0 then
    raise exception 'Los valores del tercer set no pueden ser negativos';
  end if;
  if a = b then
    raise exception 'El tercer set de muerte subita no puede terminar empatado';
  end if;

  if a > b then
    winner := p_player_a_id;
  else
    winner := p_player_b_id;
  end if;

  if p_winner_group_player_id is distinct from winner then
    raise exception 'El ganador no coincide con el tercer set';
  end if;
end;
$$;


-- Keep the fast player-submit RPC aligned with the relaxed sudden-death score format.
create or replace function public.submit_player_match_result_fast(
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
set statement_timeout = '12s'
as $$
declare
  m_old public.matches%rowtype;
  m_row public.matches%rowtype;
  uid uuid := auth.uid();
  log_action text;
  v_result_type text := coalesce(nullif(p_result_type, ''), 'normal');
  v_game_type text := coalesce(nullif(p_game_type, ''), 'best_of_3');
  v_score jsonb := p_score;
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
    select 1
    from public.tournament_rules r
    where r.tournament_id = m_old.tournament_id
      and r.allow_player_score_entry = true
  ) then
    raise exception 'La captura de marcador por jugadores no esta habilitada para este torneo';
  end if;

  if m_old.status in ('closed', 'validated', 'cancelled') then
    raise exception 'No puedes editar el marcador en este estado';
  end if;

  if m_old.status <> 'pending_score' then
    raise exception 'Solo puedes registrar marcador desde pendiente de marcador; si hubo disputa, contacta a organizacion.';
  end if;

  if v_result_type not in ('normal', 'not_reported', 'retired', 'retired_draw', 'wo', 'def') then
    raise exception 'Tipo de resultado invalido para envio de jugador';
  end if;

  if v_game_type not in ('best_of_3', 'sudden_death', 'long_set', 'best_of_3_short_tiebreak') then
    raise exception 'Tipo de juego invalido';
  end if;

  if v_result_type in ('normal', 'wo', 'def', 'retired') and (
    p_winner_group_player_id is null
    or p_winner_group_player_id not in (m_old.player_a_id, m_old.player_b_id)
  ) then
    raise exception 'Indica el ganador del partido (jugador A o B del grupo)';
  end if;

  if v_result_type = 'wo' then
    v_score := public.walkover_score_for_winner(
      p_winner_group_player_id,
      m_old.player_a_id,
      m_old.player_b_id
    );
  end if;

  if v_result_type = 'not_reported' then
    v_score := null;
  end if;

  if v_result_type in ('retired', 'retired_draw') then
    if v_game_type not in ('best_of_3', 'sudden_death') then
      raise exception 'El retiro solo aplica para partidos 2 de 3 sets o muerte subita';
    end if;

    if v_game_type = 'best_of_3' then
      if v_score is null or jsonb_typeof(v_score) <> 'array' or jsonb_array_length(v_score) = 0 or jsonb_array_length(v_score) > 3 then
        raise exception 'Retiro: indica entre 1 y 3 sets jugados';
      end if;

      select
        coalesce(sum((value->>'a')::integer), 0),
        coalesce(sum((value->>'b')::integer), 0)
      into v_a_games, v_b_games
      from jsonb_array_elements(v_score) as s(value)
      where jsonb_typeof(value->'a') = 'number'
        and jsonb_typeof(value->'b') = 'number';

      if v_a_games + v_b_games <= 0 then
        raise exception 'Retiro: debe existir al menos un game jugado';
      end if;
    end if;
  end if;

  if v_result_type = 'normal' and v_game_type in ('best_of_3', 'best_of_3_short_tiebreak') then
    if v_score is null or jsonb_typeof(v_score) <> 'array' or jsonb_array_length(v_score) = 0 then
      raise exception 'Indica el marcador por sets';
    end if;
    perform public.validate_match_score_against_tournament_rules(
      m_old.tournament_id,
      v_score,
      p_winner_group_player_id,
      m_old.player_a_id,
      m_old.player_b_id
    );
  end if;

  if v_result_type = 'normal' and v_game_type = 'long_set' then
    if v_score is null or jsonb_typeof(v_score) <> 'array' or jsonb_array_length(v_score) <> 1 then
      raise exception 'Set largo: indica exactamente 1 set';
    end if;
  end if;

  if v_result_type = 'normal' and v_game_type = 'sudden_death' then
    if v_score is not null then
      if jsonb_typeof(v_score) <> 'array' or jsonb_array_length(v_score) not in (1, 3) then
        raise exception 'Muerte subita: captura el set decisivo, 3 sets historicos o envia solo el ganador.';
      end if;
      perform public.validate_sudden_death_three_set_score(
        m_old.tournament_id,
        v_score,
        p_winner_group_player_id,
        m_old.player_a_id,
        m_old.player_b_id
      );
    end if;
  end if;

  perform set_config('app.skip_staff_notifications', 'true', true);

  log_action := case
    when uid = m_old.player_b_user_id then 'player_b_submit'
    else 'player_a_submit'
  end;

  update public.matches
  set
    score_raw = v_score,
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
    v_score,
    'closed',
    uid,
    m_old.status
  );

  return to_jsonb(m_row);
end;
$$;

revoke all on function public.submit_player_match_result_fast(uuid, jsonb, text, uuid, text) from public;
grant execute on function public.submit_player_match_result_fast(uuid, jsonb, text, uuid, text) to authenticated;
