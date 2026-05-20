-- Captura de marcador: por set solo enteros >= 0 y sin empates (sin formato ATP en servidor).

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
  max_sets int;
  need int;
  n int;
  i int;
  a int;
  b int;
  a_wins int := 0;
  b_wins int := 0;
  winner uuid;
begin
  if p_score is null or jsonb_typeof(p_score) <> 'array' or jsonb_array_length(p_score) = 0 then
    raise exception 'Indica el marcador por sets';
  end if;

  select tr.best_of_sets
  into strict v_best_of
  from public.tournament_rules tr
  where tr.tournament_id = p_tournament_id;

  max_sets := v_best_of;
  need := floor(max_sets::float / 2.0)::int + 1;

  n := jsonb_array_length(p_score);
  if n > max_sets then
    raise exception 'Máximo % sets según el torneo', max_sets;
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
  i int;
  a int;
  b int;
  winner uuid;
begin
  if p_score is null or jsonb_typeof(p_score) <> 'array' then
    raise exception 'Indica el marcador por sets (3 sets)';
  end if;

  n := jsonb_array_length(p_score);
  if n <> 3 then
    raise exception 'La muerte súbita debe capturar exactamente 3 sets';
  end if;

  for i in 0..2 loop
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
  end loop;

  a := (jsonb_array_element(p_score, 2)->>'a')::int;
  b := (jsonb_array_element(p_score, 2)->>'b')::int;

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
