-- Idempotent repair: DBs that never ran 015 (or drifted) lack match-format columns on
-- tournament_rules. PostgREST then returns 400 e.g. "Could not find the 'final_set_format'
-- column ... in the schema cache" when the client selects or expects those fields.

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
