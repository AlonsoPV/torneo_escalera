-- Normaliza N.R. / not_reported:
-- - marcador administrativo 3-6, 3-6
-- - sin ganador
-- - puntos/ranking siguen como penalizacion mutua (-1 / -1) en la app.

create or replace function public.normalize_not_reported_admin_score()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.result_type = 'not_reported'
     and new.status in ('closed', 'validated')
  then
    new.score_raw := '[{"a":3,"b":6},{"a":3,"b":6}]'::jsonb;
    new.winner_id := null;
    new.game_type := 'best_of_3';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_not_reported_admin_score on public.matches;

create trigger trg_normalize_not_reported_admin_score
before insert or update of result_type, status, score_raw, winner_id, game_type
on public.matches
for each row
execute function public.normalize_not_reported_admin_score();

update public.matches
set
  score_raw = '[{"a":3,"b":6},{"a":3,"b":6}]'::jsonb,
  winner_id = null,
  game_type = 'best_of_3'
where result_type = 'not_reported'
  and status in ('closed', 'validated');
