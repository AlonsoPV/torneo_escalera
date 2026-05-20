-- Muerte súbita como formato de partido: exactamente 3 sets; sets 1-2 a games; set 3 carrera a 7 (7-0 … 7-6).
-- El ganador del partido es solo el del tercer set.

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
    raise exception 'Indica el marcador por sets (3 sets)';
  end if;

  n := jsonb_array_length(p_score);
  if n <> 3 then
    raise exception 'La muerte súbita debe capturar exactamente 3 sets';
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

  -- Sets 1 y 2: validación a games.
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
      raise exception 'Set inválido para jugar a % games (diferencia mín. %, tie-break según reglas).',
        games_i, min_diff;
    end if;
  end loop;

  -- Set 3: muerte súbita a 7
  a := (jsonb_array_element(p_score, 2)->>'a')::int;
  b := (jsonb_array_element(p_score, 2)->>'b')::int;
  if a is null or b is null then
    raise exception 'El tercer set debe tener valores a y b';
  end if;
  if a < 0 or b < 0 then
    raise exception 'Los valores del tercer set no pueden ser negativos';
  end if;
  if a = b then
    raise exception 'El tercer set de muerte súbita no puede terminar empatado';
  end if;
  mx := greatest(a, b);
  mi := least(a, b);
  if mx <> 7 then
    raise exception 'El ganador del tercer set debe llegar a 7';
  end if;
  if mi > 6 then
    raise exception 'El tercer set no puede superar 7 para el ganador';
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

  if p_result_type = 'normal' and p_game_type = 'sudden_death' then
    if p_score is null or jsonb_typeof(p_score) <> 'array' or jsonb_array_length(p_score) <> 3 then
      raise exception 'Muerte súbita: indica exactamente 3 sets';
    end if;
    perform public.validate_sudden_death_three_set_score(
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

create or replace function public.admin_set_match_result(
  p_match_id uuid,
  p_score jsonb,
  p_winner_id uuid,
  p_status text,
  p_result_type text default 'normal',
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
begin
  if not public.is_admin() then
    raise exception 'Solo staff';
  end if;

  if p_status not in (
    'pending_score',
    'score_submitted',
    'score_disputed',
    'player_confirmed',
    'closed',
    'cancelled'
  ) then
    raise exception 'Estado inválido';
  end if;

  if p_game_type not in ('best_of_3', 'sudden_death', 'long_set', 'best_of_3_short_tiebreak') then
    raise exception 'Tipo de juego inválido';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Partido no encontrado';
  end if;

  if p_status <> 'cancelled' then
    if p_result_type in ('not_reported', 'double_penalty', 'pending_score') then
      null;
    elsif p_winner_id is null then
      raise exception 'Indica el ganador del partido';
    elsif p_winner_id not in (m.player_a_id, m.player_b_id) then
      raise exception 'El ganador debe ser el jugador A o B del partido';
    end if;
  end if;

  if p_result_type = 'normal'
     and p_game_type = 'sudden_death'
     and p_score is not null
     and jsonb_typeof(p_score) = 'array'
     and jsonb_array_length(p_score) = 3
     and p_winner_id is not null
     and p_winner_id in (m.player_a_id, m.player_b_id)
  then
    perform public.validate_sudden_death_three_set_score(
      m.tournament_id,
      p_score,
      p_winner_id,
      m.player_a_id,
      m.player_b_id
    );
  end if;

  update public.matches
  set
    score_raw = p_score,
    winner_id = case
      when p_status = 'cancelled' then null
      when p_result_type in ('not_reported', 'double_penalty', 'pending_score') then null
      else p_winner_id
    end,
    game_type = coalesce(nullif(p_game_type, ''), 'best_of_3'),
    result_type = p_result_type,
    status = p_status,
    updated_by = uid,
    updated_at = now(),
    locked_at = case
      when p_status in ('score_submitted', 'player_confirmed', 'closed') then coalesce(locked_at, now())
      else locked_at
    end,
    admin_validated_by = case
      when p_status = 'closed' then uid
      when p_status in ('pending_score', 'score_submitted', 'score_disputed') then null
      else admin_validated_by
    end,
    admin_validated_at = case
      when p_status = 'closed' then now()
      when p_status in ('pending_score', 'score_submitted', 'score_disputed') then null
      else admin_validated_at
    end,
    closed_at = case
      when p_status = 'closed' then now()
      when p_status in ('pending_score', 'score_submitted', 'score_disputed', 'player_confirmed', 'cancelled') then null
      else closed_at
    end,
    confirmed_at = case
      when p_status = 'closed' then coalesce(confirmed_at, now())
      else confirmed_at
    end,
    confirmed_by = case
      when p_status = 'closed' then coalesce(confirmed_by, uid)
      else confirmed_by
    end
  where id = p_match_id;

  insert into public.match_score_logs (
    match_id, action_type, previous_score_json, new_score_json, new_status, changed_by, previous_status
  ) values (
    p_match_id,
    'admin_update',
    m.score_raw,
    p_score,
    p_status,
    uid,
    m.status
  );
end;
$$;
