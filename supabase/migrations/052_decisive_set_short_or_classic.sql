-- Set decisivo en 2 de 3: acepta super tie-break (1-0) o marcador clásico (6-0…6-4, 7-5, 7-6).
-- Alineado con src/lib/tournamentRulesEngine.ts

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

    deciding := (need > 1 and a_wins = need - 1 and b_wins = need - 1);
    use_short := deciding and final_fmt in ('sudden_death', 'super_tiebreak');

    if use_short then
      short_ok := (a = 1 and b = 0) or (a = 0 and b = 1);
      classic_ok := games_i = 6 and public.is_valid_classic_six_game_set(a, b);
      if not (short_ok or classic_ok) then
        raise exception 'Set decisivo: super tie-break (1-0) o marcador clásico (6-0…6-4, 7-5, 7-6)';
      end if;
    elsif games_i = 6 then
      if not public.is_valid_classic_six_game_set(a, b) then
        raise exception 'Set inválido: use 6-0…6-4, 7-5 o 7-6 (tie-break como 7-6)';
      end if;
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
