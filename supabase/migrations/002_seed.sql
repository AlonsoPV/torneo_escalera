-- Demo seed: torneo + 2 grupos + reglas. Asigna jugadores y genera partidos desde el panel admin.
insert into public.tournaments (name, description, category, status, created_by)
select
  'Torneo Mega Varonil',
  'Torneo de demostración para probar grupos y matriz.',
  'Open',
  'active',
  null
where not exists (
  select 1 from public.tournaments t where t.name = 'Torneo Mega Varonil'
);

insert into public.tournament_rules (
  tournament_id,
  best_of_sets,
  set_points,
  tiebreak_enabled,
  super_tiebreak_final_set,
  points_per_win,
  points_per_loss,
  allow_player_score_entry
)
select t.id, 3, 6, true, false, 3, 0, true
from public.tournaments t
where t.name = 'Torneo Mega Varonil'
  and not exists (
    select 1 from public.tournament_rules r where r.tournament_id = t.id
  );

insert into public.groups (tournament_id, name, order_index)
select t.id, v.name, v.order_index
from public.tournaments t
cross join (
  values
    ('Grupo A', 0),
    ('Grupo B', 1)
) as v(name, order_index)
where t.name = 'Torneo Mega Varonil'
  and not exists (
    select 1 from public.groups g
    where g.tournament_id = t.id and g.name = v.name
  );
