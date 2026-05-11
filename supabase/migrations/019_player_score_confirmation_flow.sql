-- Flujo explícito: pending_score → score_submitted (Jugador A) → player_confirmed (Jugador B) → closed (admin).
-- Reemplazo idempotente de la respuesta del rival + permisos sobre las firmas actuales de los RPC (p. ej. tras añadir p_game_type).

create or replace function public.opponent_respond_match_score(
  p_match_id uuid,
  p_accept boolean,
  p_dispute_reason text default null
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
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Partido no encontrado';
  end if;

  if m.player_b_user_id <> uid then
    raise exception 'Solo el segundo jugador del cruce puede aceptar o rechazar el marcador';
  end if;

  if public.is_admin() then
    raise exception 'Usa el flujo de administrador';
  end if;

  if m.status <> 'score_submitted' then
    raise exception 'No hay un marcador pendiente de tu revisión';
  end if;

  if p_accept then
    update public.matches
    set
      status = 'player_confirmed',
      opponent_confirmed_by = uid,
      opponent_confirmed_at = now(),
      updated_by = uid,
      updated_at = now()
    where id = p_match_id;

    insert into public.match_score_logs (
      match_id, action_type, previous_score_json, new_score_json, new_status, changed_by, previous_status
    ) values (
      p_match_id,
      'opponent_accept',
      m.score_raw,
      m.score_raw,
      'player_confirmed',
      uid,
      m.status
    );
  else
    if p_dispute_reason is null or length(trim(p_dispute_reason)) < 3 then
      raise exception 'Escribe un motivo de rechazo (mín. 3 caracteres)';
    end if;

    update public.matches
    set
      status = 'score_disputed',
      dispute_reason = trim(p_dispute_reason),
      updated_by = uid,
      updated_at = now()
    where id = p_match_id;

    insert into public.match_score_logs (
      match_id, action_type, previous_score_json, new_score_json, new_status, changed_by, previous_status
    ) values (
      p_match_id,
      'opponent_reject',
      m.score_raw,
      m.score_raw,
      'score_disputed',
      uid,
      m.status
    );
  end if;
end;
$$;

grant execute on function public.opponent_respond_match_score(uuid, boolean, text) to authenticated;
grant execute on function public.submit_player_match_result(uuid, jsonb, text, uuid, text) to authenticated;
grant execute on function public.admin_set_match_result(uuid, jsonb, uuid, text, text, text) to authenticated;
