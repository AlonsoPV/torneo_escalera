-- Tipos de resultado extendidos (importación histórica / operativo) y game_type para tie-break corto decisivo.
-- admin_set_match_result: permite winner_id NULL para penalización mutua (not_reported, pending_score, double_penalty).

alter table public.matches drop constraint if exists matches_game_type_check;

alter table public.matches
  add constraint matches_game_type_check check (
    game_type in ('best_of_3', 'sudden_death', 'long_set', 'best_of_3_short_tiebreak')
  );

alter table public.matches drop constraint if exists matches_result_type_check;

alter table public.matches
  add constraint matches_result_type_check check (
    result_type in (
      'normal',
      'default_win_a',
      'default_win_b',
      'wo',
      'def',
      'not_reported',
      'retired',
      'pending_score',
      'double_penalty'
    )
  );

create or replace function public.admin_set_match_result(
  p_match_id uuid,
  p_score jsonb,
  p_winner_id uuid,
  p_status text,
  p_result_type text default 'normal',
  p_game_type text default 'best_of_3'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  uid uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Solo staff';
  end if;

  if p_status not in (
    'pending_score',
    'score_submitted',
    'score_disputed',
    'player_confirmed',
    'closed',
    'cancelled'
  ) then
    raise exception 'Estado inválido';
  end if;

  if p_game_type not in ('best_of_3', 'sudden_death', 'long_set', 'best_of_3_short_tiebreak') then
    raise exception 'Tipo de juego inválido';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Partido no encontrado';
  end if;

  if p_status <> 'cancelled' then
    if p_result_type in ('not_reported', 'double_penalty', 'pending_score') then
      null;
    elsif p_winner_id is null then
      raise exception 'Indica el ganador del partido';
    elsif p_winner_id not in (m.player_a_id, m.player_b_id) then
      raise exception 'El ganador debe ser el jugador A o B del partido';
    end if;
  end if;

  update public.matches
  set
    score_raw = p_score,
    winner_id = case
      when p_status = 'cancelled' then null
      when p_result_type in ('not_reported', 'double_penalty', 'pending_score') then null
      else p_winner_id
    end,
    game_type = coalesce(nullif(p_game_type, ''), 'best_of_3'),
    result_type = p_result_type,
    status = p_status,
    updated_by = uid,
    updated_at = now(),
    locked_at = case
      when p_status in ('score_submitted', 'player_confirmed', 'closed') then coalesce(locked_at, now())
      else locked_at
    end,
    admin_validated_by = case
      when p_status = 'closed' then uid
      when p_status in ('pending_score', 'score_submitted', 'score_disputed') then null
      else admin_validated_by
    end,
    admin_validated_at = case
      when p_status = 'closed' then now()
      when p_status in ('pending_score', 'score_submitted', 'score_disputed') then null
      else admin_validated_at
    end,
    closed_at = case
      when p_status = 'closed' then now()
      when p_status in ('pending_score', 'score_submitted', 'score_disputed', 'player_confirmed', 'cancelled') then null
      else closed_at
    end,
    confirmed_at = case
      when p_status = 'closed' then coalesce(confirmed_at, now())
      else confirmed_at
    end,
    confirmed_by = case
      when p_status = 'closed' then coalesce(confirmed_by, uid)
      else confirmed_by
    end
  where id = p_match_id;

  insert into public.match_score_logs (
    match_id, action_type, previous_score_json, new_score_json, new_status, changed_by, previous_status
  ) values (
    p_match_id,
    'admin_update',
    m.score_raw,
    p_score,
    p_status,
    uid,
    m.status
  );
end;
$$;

grant execute on function public.admin_set_match_result(uuid, jsonb, uuid, text, text, text) to authenticated;
