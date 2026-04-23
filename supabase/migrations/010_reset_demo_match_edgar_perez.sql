-- Deja sin jugar el cruce demo Zaiah vs Edgar Pérez / Alonso Vazquez (user_id de10029f-061d-48c2-8aeb-cd43f4c437a3)
-- en Torneo Mega Varonil · Grupo A (por si hubo capturas de prueba).

update public.matches m
set
  score_raw = null,
  winner_id = null,
  status = 'pending',
  result_type = 'normal',
  scheduled_date = null,
  scheduled_start_at = null,
  scheduled_end_at = null,
  locked_at = null,
  confirmed_at = null,
  confirmed_by = null,
  updated_at = now()
where exists (
    select 1
    from public.groups g
    join public.tournaments t on t.id = g.tournament_id
    where g.id = m.group_id
      and t.name = 'Torneo Mega Varonil'
      and g.name = 'Grupo A'
  )
  and (
    (m.player_a_user_id = '6042f4d5-8ceb-4e3b-9f88-674a330fc777'::uuid
      and m.player_b_user_id = 'de10029f-061d-48c2-8aeb-cd43f4c437a3'::uuid)
    or
    (m.player_b_user_id = '6042f4d5-8ceb-4e3b-9f88-674a330fc777'::uuid
      and m.player_a_user_id = 'de10029f-061d-48c2-8aeb-cd43f4c437a3'::uuid)
  );
