-- Validación de marcador (reglas del torneo) en servidor y reenvío/edicion por el
-- jugador mientras status = result_submitted (antes de confirmed/corrected).

-- ---------------------------------------------------------------------------
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
  r record;
  max_sets int;
  set_points int;
  tb_en boolean;
  need int;
  n int;
  i int;
  a int;
  b int;
  a_wins int := 0;
  b_wins int := 0;
  mx int;
  mi int;
  is_std boolean;
  is_tb boolean;
  winner uuid;
  best_of int;
begin
  if p_score is null or jsonb_typeof(p_score) <> 'array' or jsonb_array_length(p_score) = 0 then
    raise exception 'Indica el marcador por sets';
  end if;

  select
    tr.best_of_sets,
    tr.set_points,
    tr.tiebreak_enabled
  into r
  from public.tournament_rules tr
  where tr.tournament_id = p_tournament_id;

  if not found then
    raise exception 'Reglas del torneo no encontradas';
  end if;

  best_of := r.best_of_sets;
  set_points := r.set_points;
  tb_en := r.tiebreak_enabled;
  max_sets := best_of;
  need := floor(max_sets::float / 2.0)::int + 1;

  n := jsonb_array_length(p_score);
  if n > max_sets then
    raise exception 'Máximo % sets según el torneo', max_sets;
  end if;

  for i in 0..(n - 1) loop
    a := (jsonb_array_element(p_score, i)->>'a')::int;
    b := (jsonb_array_element(p_score, i)->>'b')::int;
    if a is null or b is null then
      raise exception 'Cada set debe tener juegos a y b';
    end if;
    if a < 0 or b < 0 then
      raise exception 'Los games no pueden ser negativos';
    end if;
    if a = b then
      raise exception 'Un set no puede terminar empatado';
    end if;
    mx := greatest(a, b);
    mi := least(a, b);
    is_std := (mx = set_points and (mx - mi) >= 2);
    is_tb := (tb_en and mx = set_points + 1 and mi = set_points);
    if mx > set_points and not is_std and not is_tb then
      raise exception 'Set inválido para jugar a % games (tiebreak simplificado: %-%).',
        set_points, set_points, set_points + 1;
    end if;
    if a > b then
      a_wins := a_wins + 1;
    else
      b_wins := b_wins + 1;
    end if;
  end loop;

  if a_wins < need and b_wins < need then
    raise exception 'El marcador no define un ganador según el formato del torneo';
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

-- ---------------------------------------------------------------------------
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
    if m.scheduled_end_at is null then
      raise exception 'El partido no tiene hora de fin; el organizador debe agendarlo';
    end if;
    if m.scheduled_end_at >= now() then
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

comment on function public.validate_match_score_against_tournament_rules is
  'Alinea validación con la app: mejor de N sets, games, tiebreak, ganador.';
