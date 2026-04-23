-- Todos los cruces round robin en Grupo A de «Torneo Mega Varonil»: un partido `pending`
-- por cada par de jugadores inscritos (2–5). Idempotente (no duplica pares).
-- Orden canónico player_a / player_b: menor seed_order; empate → menor id::text (igual que la app).

with grp as (
  select t.id as tournament_id, g.id as group_id
  from public.tournaments t
  join public.groups g on g.tournament_id = t.id and g.name = 'Grupo A'
  where t.name = 'Torneo Mega Varonil'
),
pairs as (
  select
    grp.tournament_id,
    grp.group_id,
    g1.id as g1_id,
    g2.id as g2_id,
    g1.user_id as g1_uid,
    g2.user_id as g2_uid,
    g1.seed_order as s1,
    g2.seed_order as s2
  from grp
  join public.group_players g1 on g1.group_id = grp.group_id
  join public.group_players g2
    on g2.group_id = grp.group_id
    and g1.id::text < g2.id::text
),
canon as (
  select
    tournament_id,
    group_id,
    case
      when s1 < s2 then g1_id
      when s2 < s1 then g2_id
      when g1_id::text < g2_id::text then g1_id
      else g2_id
    end as player_a_id,
    case
      when s1 < s2 then g2_id
      when s2 < s1 then g1_id
      when g1_id::text < g2_id::text then g2_id
      else g1_id
    end as player_b_id,
    case
      when s1 < s2 then g1_uid
      when s2 < s1 then g2_uid
      when g1_id::text < g2_id::text then g1_uid
      else g2_uid
    end as player_a_user_id,
    case
      when s1 < s2 then g2_uid
      when s2 < s1 then g1_uid
      when g1_id::text < g2_id::text then g2_uid
      else g1_uid
    end as player_b_user_id
  from pairs
)
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
  c.tournament_id,
  c.group_id,
  c.player_a_id,
  c.player_b_id,
  c.player_a_user_id,
  c.player_b_user_id,
  'pending'
from canon c
where not exists (
  select 1
  from public.matches m
  where m.group_id = c.group_id
    and (
      (m.player_a_id = c.player_a_id and m.player_b_id = c.player_b_id)
      or (m.player_a_id = c.player_b_id and m.player_b_id = c.player_a_id)
    )
);
