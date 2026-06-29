-- Normaliza penalizacion mutua cerrada:
-- - not_reported / double_penalty guardan marcador administrativo 3-6, 3-6
-- - sin ganador
-- - la app interpreta esos games por perspectiva: ambos jugadores pierden 3-6, 3-6.

create or replace function public.normalize_not_reported_admin_score()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.result_type in ('not_reported', 'double_penalty')
     and new.status in ('closed', 'validated')
  then
    new.score_raw := '[{"a":3,"b":6},{"a":3,"b":6}]'::jsonb;
    new.winner_id := null;
    new.game_type := 'best_of_3';
  end if;

  return new;
end;
$$;

update public.matches
set
  score_raw = '[{"a":3,"b":6},{"a":3,"b":6}]'::jsonb,
  winner_id = null,
  game_type = 'best_of_3'
where result_type in ('not_reported', 'double_penalty')
  and status in ('closed', 'validated');
