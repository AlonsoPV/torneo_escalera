-- Keep player score submission fast: staff notifications must not do extra joins
-- inside the same transaction that closes the match.

create or replace function public.notify_staff_on_player_score_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
  v_title text;
  v_body text;
  v_meta jsonb;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.score_submitted_by is null then
    return new;
  end if;

  if new.status = 'closed'
     and old.status is distinct from 'closed'
     and old.status = 'pending_score' then
    v_event := 'player_match_closed';
    v_title := 'Resultado oficial registrado por jugador';
  elsif new.status = 'score_submitted'
     and old.status is distinct from 'score_submitted'
     and old.status = 'pending_score' then
    v_event := 'player_score_submitted';
    v_title := 'Resultado provisional registrado por jugador';
  else
    return new;
  end if;

  v_body := 'Resultado registrado por jugador. Revisa el detalle del partido en administracion.';
  v_meta := jsonb_build_object(
    'match_id', new.id,
    'tournament_id', new.tournament_id,
    'group_id', new.group_id,
    'previous_status', old.status,
    'status', new.status,
    'result_type', new.result_type,
    'game_type', new.game_type,
    'winner_id', new.winner_id,
    'score_raw', new.score_raw,
    'score_submitted_by', new.score_submitted_by,
    'score_submitted_at', new.score_submitted_at
  );

  insert into public.staff_match_notifications (
    match_id,
    tournament_id,
    group_id,
    event_type,
    title,
    body,
    metadata
  ) values (
    new.id,
    new.tournament_id,
    new.group_id,
    v_event,
    v_title,
    v_body,
    v_meta
  );

  return new;
end;
$$;
