-- Inscribe jugadores reales en el torneo demo "Torneo Mega Varonil" (Grupo A) y crea el cruce 1vs1.
-- Solo aplica filas si el perfil existe (FK a profiles).

insert into public.group_players (group_id, user_id, display_name, seed_order)
select g.id, u.uid, u.dname, u.seed
from public.tournaments t
join public.groups g on g.tournament_id = t.id and g.name = 'Grupo A'
cross join (
  values
    ('6042f4d5-8ceb-4e3b-9f88-674a330fc777'::uuid, 'Zaiah', 1),
    ('de10029f-061d-48c2-8aeb-cd43f4c437a3'::uuid, 'Alonso Vazquez', 2)
) as u(uid, dname, seed)
inner join public.profiles p on p.id = u.uid
where t.name = 'Torneo Mega Varonil'
on conflict (group_id, user_id) do update set
  display_name = excluded.display_name,
  seed_order = excluded.seed_order;

insert into public.matches (
  tournament_id,
  group_id,
  player_a_id,
  player_b_id,
  player_a_user_id,
  player_b_user_id,
  status
)
select
  t.id,
  g.id,
  gp_zaiah.id,
  gp_edgar.id,
  gp_zaiah.user_id,
  gp_edgar.user_id,
  'pending'
from public.tournaments t
join public.groups g on g.tournament_id = t.id and g.name = 'Grupo A'
join public.group_players gp_zaiah
  on gp_zaiah.group_id = g.id
  and gp_zaiah.user_id = '6042f4d5-8ceb-4e3b-9f88-674a330fc777'::uuid
join public.group_players gp_edgar
  on gp_edgar.group_id = g.id
  and gp_edgar.user_id = 'de10029f-061d-48c2-8aeb-cd43f4c437a3'::uuid
where t.name = 'Torneo Mega Varonil'
  and exists (select 1 from public.profiles where id = gp_zaiah.user_id)
  and exists (select 1 from public.profiles where id = gp_edgar.user_id)
  and not exists (
    select 1
    from public.matches m
    where m.group_id = g.id
      and (
        (m.player_a_id = gp_zaiah.id and m.player_b_id = gp_edgar.id)
        or (m.player_a_id = gp_edgar.id and m.player_b_id = gp_zaiah.id)
      )
  );
