-- Inscribe edgarperez (6c0d9322-048c-4426-84d8-1a8312b23edf) en Grupo A de «Torneo Mega Varonil»
-- y crea cruces pendientes vs Zaiah y Alonso Vazquez. Los super_admin no entran por el trigger de auto-inscripción (solo `player`).

insert into public.group_players (group_id, user_id, display_name, seed_order)
select g.id, '6c0d9322-048c-4426-84d8-1a8312b23edf'::uuid, 'edgarperez', 3
from public.tournaments t
join public.groups g on g.tournament_id = t.id and g.name = 'Grupo A'
where t.name = 'Torneo Mega Varonil'
  and exists (select 1 from public.profiles p where p.id = '6c0d9322-048c-4426-84d8-1a8312b23edf'::uuid)
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
  gp_z.id,
  gp_ep.id,
  gp_z.user_id,
  gp_ep.user_id,
  'pending'
from public.tournaments t
join public.groups g on g.tournament_id = t.id and g.name = 'Grupo A'
join public.group_players gp_z
  on gp_z.group_id = g.id
  and gp_z.user_id = '6042f4d5-8ceb-4e3b-9f88-674a330fc777'::uuid
join public.group_players gp_ep
  on gp_ep.group_id = g.id
  and gp_ep.user_id = '6c0d9322-048c-4426-84d8-1a8312b23edf'::uuid
where t.name = 'Torneo Mega Varonil'
  and not exists (
    select 1
    from public.matches m
    where m.group_id = g.id
      and (
        (m.player_a_id = gp_z.id and m.player_b_id = gp_ep.id)
        or (m.player_a_id = gp_ep.id and m.player_b_id = gp_z.id)
      )
  );

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
  gp_al.id,
  gp_ep.id,
  gp_al.user_id,
  gp_ep.user_id,
  'pending'
from public.tournaments t
join public.groups g on g.tournament_id = t.id and g.name = 'Grupo A'
join public.group_players gp_al
  on gp_al.group_id = g.id
  and gp_al.user_id = 'de10029f-061d-48c2-8aeb-cd43f4c437a3'::uuid
join public.group_players gp_ep
  on gp_ep.group_id = g.id
  and gp_ep.user_id = '6c0d9322-048c-4426-84d8-1a8312b23edf'::uuid
where t.name = 'Torneo Mega Varonil'
  and not exists (
    select 1
    from public.matches m
    where m.group_id = g.id
      and (
        (m.player_a_id = gp_al.id and m.player_b_id = gp_ep.id)
        or (m.player_a_id = gp_ep.id and m.player_b_id = gp_al.id)
      )
  );
