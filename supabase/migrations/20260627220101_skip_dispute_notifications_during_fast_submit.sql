create or replace function public.notify_staff_on_match_disputed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gname text;
  v_tname text;
  v_cat text;
  v_pa text;
  v_pb text;
  v_submitter text;
  v_disputer text;
  v_winner_label text;
  v_body text;
  v_meta jsonb;
  i int;
  el jsonb;
  parts text[] := array[]::text[];
begin
  if current_setting('app.skip_staff_notifications', true) = 'true' then
    return new;
  end if;

  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if not (
    new.status = 'score_disputed'
    and old.status in ('closed', 'score_submitted')
  ) then
    return new;
  end if;

  select g.name, t.name, gc.name
    into v_gname, v_tname, v_cat
  from public.groups g
  join public.tournaments t on t.id = g.tournament_id
  left join public.group_categories gc on gc.id = g.group_category_id
  where g.id = new.group_id;

  select coalesce(max(case when gp.id = new.player_a_id then gp.display_name end), 'Jugador A'),
         coalesce(max(case when gp.id = new.player_b_id then gp.display_name end), 'Jugador B')
    into v_pa, v_pb
  from public.group_players gp
  where gp.id in (new.player_a_id, new.player_b_id);

  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Jugador')
    into v_submitter
  from public.profiles p
  where p.id = new.score_submitted_by;

  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Jugador')
    into v_disputer
  from public.profiles p
  where p.id = new.disputed_by;

  if new.winner_id = new.player_a_id then
    v_winner_label := coalesce(v_pa, 'Jugador A');
  elsif new.winner_id = new.player_b_id then
    v_winner_label := coalesce(v_pb, 'Jugador B');
  else
    v_winner_label := '-';
  end if;

  if new.score_raw is not null
     and jsonb_typeof(new.score_raw) = 'array'
     and jsonb_array_length(new.score_raw) > 0
  then
    for i in 0..jsonb_array_length(new.score_raw) - 1 loop
      el := new.score_raw -> i;
      parts := parts || (coalesce(el ->> 'a', '?') || '-' || coalesce(el ->> 'b', '?'));
    end loop;
  end if;

  v_body := format(
    'REFUTACION - Torneo: %s - Categoria: %s - Grupo: %s - %s vs %s - Marcador: %s - Ganador registrado: %s - Registro: %s - Refuto: %s - Motivo: %s - Activo para revision admin - %s',
    coalesce(v_tname, '-'),
    coalesce(v_cat, '-'),
    coalesce(v_gname, '-'),
    coalesce(v_pa, 'A'),
    coalesce(v_pb, 'B'),
    case when cardinality(parts) > 0 then array_to_string(parts, ' / ') else '-' end,
    v_winner_label,
    coalesce(v_submitter, '-'),
    coalesce(v_disputer, '-'),
    coalesce(nullif(trim(new.dispute_reason), ''), '-'),
    to_char(coalesce(new.disputed_at, new.updated_at, now()) at time zone 'UTC', 'YYYY-MM-DD HH24:MI TZ')
  );

  v_meta := jsonb_build_object(
    'match_id', new.id,
    'tournament_id', new.tournament_id,
    'group_id', new.group_id,
    'tournament_name', v_tname,
    'group_name', v_gname,
    'category_name', v_cat,
    'player_a_name', v_pa,
    'player_b_name', v_pb,
    'score_raw', new.score_raw,
    'winner_id', new.winner_id,
    'winner_label', v_winner_label,
    'score_submitted_by', new.score_submitted_by,
    'score_submitted_by_label', v_submitter,
    'disputed_by', new.disputed_by,
    'disputed_by_label', v_disputer,
    'dispute_reason', new.dispute_reason,
    'disputed_at', coalesce(new.disputed_at, new.updated_at),
    'deep_link_path', '/admin/matches',
    'deep_link_query', jsonb_build_object(
      'tournament', new.tournament_id::text,
      'group', new.group_id::text,
      'status', 'score_disputed',
      'match', new.id::text
    )
  );

  insert into public.staff_match_notifications (
    match_id, tournament_id, group_id, event_type, title, body, metadata
  ) values (
    new.id,
    new.tournament_id,
    new.group_id,
    'player_match_disputed',
    'Marcador refutado - revision administrativa',
    v_body,
    coalesce(v_meta, '{}'::jsonb)
  );

  return new;
end;
$$;
