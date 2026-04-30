-- Reglas de partido (formato real) + validación de marcador ampliada.

alter table public.tournament_rules
  add column if not exists match_format text not null default 'best_of_3'
    check (match_format in ('one_set', 'best_of_3', 'best_of_5'));

alter table public.tournament_rules
  add column if not exists set_type text not null default 'long_set'
    check (set_type in ('long_set', 'short_set', 'tiebreak_set', 'pro_set'));

alter table public.tournament_rules
  add column if not exists games_per_set int not null default 6
    check (games_per_set in (4, 6, 8));

alter table public.tournament_rules
  add column if not exists min_game_difference int not null default 2
    check (min_game_difference in (1, 2));

alter table public.tournament_rules
  add column if not exists tiebreak_at int
    check (tiebreak_at is null or tiebreak_at in (5, 6));

alter table public.tournament_rules
  add column if not exists final_set_format text not null default 'sudden_death'
    check (final_set_format in ('full_set', 'sudden_death', 'super_tiebreak', 'none'));

alter table public.tournament_rules
  add column if not exists sudden_death_points int not null default 10
    check (sudden_death_points in (7, 10));

update public.tournament_rules
set
  games_per_set = coalesce(nullif(games_per_set, 0), set_points, 6),
  match_format = case best_of_sets
    when 1 then 'one_set'
    when 5 then 'best_of_5'
    else 'best_of_3'
  end,
  tiebreak_at = case
    when tiebreak_enabled then coalesce(tiebreak_at, 6)
    else null
  end
where true;

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
  tb_en boolean;
  max_sets int;
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
  min_diff int;
  tb_at int;
  final_fmt text;
  sdp int;
  deciding boolean;
  use_short boolean;
begin
  if p_score is null or jsonb_typeof(p_score) <> 'array' or jsonb_array_length(p_score) = 0 then
    raise exception 'Indica el marcador por sets';
  end if;

  select
    tr.best_of_sets,
    tr.tiebreak_enabled,
    coalesce(tr.games_per_set, tr.set_points),
    coalesce(tr.min_game_difference, 2),
    tr.tiebreak_at,
    tr.final_set_format,
    tr.sudden_death_points
  into strict v_best_of, tb_en, games_i, min_diff, tb_at, final_fmt, sdp
  from public.tournament_rules tr
  where tr.tournament_id = p_tournament_id;

  games_i := greatest(games_i, 1);
  min_diff := greatest(min_diff, 1);
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
      mx := greatest(a, b);
      mi := least(a, b);
      if mx < sdp or (mx - mi) < 2 then
        raise exception 'Set decisivo inválido: muerte súbita a % puntos con diferencia mínima de 2 (ej. %-%).',
          sdp, sdp, sdp - 2;
      end if;
    else
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
