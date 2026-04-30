-- Flujo de marcador: Jugador A envía → Jugador B acepta/rechaza → Admin valida y cierra.
-- Nuevos estados y columnas de auditoría.

-- ---------------------------------------------------------------------------
-- Columnas en matches
-- ---------------------------------------------------------------------------
alter table public.matches add column if not exists score_submitted_by uuid references public.profiles (id);
alter table public.matches add column if not exists score_submitted_at timestamptz;
alter table public.matches add column if not exists opponent_confirmed_by uuid references public.profiles (id);
alter table public.matches add column if not exists opponent_confirmed_at timestamptz;
alter table public.matches add column if not exists admin_validated_by uuid references public.profiles (id);
alter table public.matches add column if not exists admin_validated_at timestamptz;
alter table public.matches add column if not exists closed_at timestamptz;
alter table public.matches add column if not exists dispute_reason text;
alter table public.matches add column if not exists admin_notes text;

-- ---------------------------------------------------------------------------
-- Migrar estados legacy (antes de reemplazar el check)
-- ---------------------------------------------------------------------------
update public.matches
set status = 'scheduled'
where status = 'pending';

update public.matches
set status = 'ready_for_score'
where status = 'ready_for_result';

update public.matches
set status = 'score_submitted'
where status = 'result_submitted';

update public.matches
set
  status = 'closed',
  closed_at = coalesce(confirmed_at, now()),
  admin_validated_at = coalesce(confirmed_at, now()),
  admin_validated_by = confirmed_by
where status in ('confirmed', 'corrected');

alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches
  add constraint matches_status_check
  check (
    status in (
      'scheduled',
      'ready_for_score',
      'score_submitted',
      'score_disputed',
      'player_confirmed',
      'admin_validated',
      'closed',
      'cancelled'
    )
  );

alter table public.matches alter column status set default 'scheduled';

-- ---------------------------------------------------------------------------
-- Helpers de ventana / listo para marcador
-- ---------------------------------------------------------------------------
create or replace function public.match_ready_for_result(m public.matches)
returns boolean
language sql
stable
as $$
  select
    (m.scheduled_end_at is null or m.scheduled_end_at < now())
    and m.status in ('scheduled', 'ready_for_score');
$$;

comment on function public.match_ready_for_result is
  'Alias histórico: partido en ventana de captura antes de envío del Jugador A.';

-- ---------------------------------------------------------------------------
-- Jugador A: enviar / corregir marcador (solo scheduled, ready_for_score, score_disputed)
-- ---------------------------------------------------------------------------
create or replace function public.submit_player_match_result(
  p_match_id uuid,
  p_score jsonb,
  p_result_type text default 'normal',
  p_winner_group_player_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  uid uuid := auth.uid();
  log_action text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Partido no encontrado';
  end if;

  if m.player_a_user_id <> uid then
    raise exception 'Solo el Jugador A (primer jugador del cruce) puede registrar o corregir el marcador';
  end if;

  if not exists (
    select 1 from public.tournament_rules r2
    where r2.tournament_id = m.tournament_id
      and r2.allow_player_score_entry = true
  ) then
    raise exception 'La captura de marcador por jugadores no está habilitada para este torneo';
  end if;

  if public.is_admin() then
    raise exception 'Usa el flujo de administrador para editar';
  end if;

  if m.status in ('score_submitted', 'player_confirmed', 'admin_validated', 'closed', 'cancelled') then
    raise exception 'No puedes editar el marcador en este estado';
  end if;

  if m.status not in ('scheduled', 'ready_for_score', 'score_disputed') then
    raise exception 'Estado de partido no válido para envío';
  end if;

  if p_result_type = 'normal' and (
    p_winner_group_player_id is null
    or p_winner_group_player_id not in (m.player_a_id, m.player_b_id)
  ) then
    raise exception 'Indica el ganador del partido (jugador A o B del grupo)';
  end if;

  if p_result_type = 'normal' then
    if p_score is null or jsonb_array_length(p_score) = 0 then
      raise exception 'Indica el marcador por sets';
    end if;
    if m.scheduled_end_at is not null and m.scheduled_end_at >= now() then
      raise exception 'Aún no puedes registrar el resultado (debe pasar la hora de fin)';
    end if;
    perform public.validate_match_score_against_tournament_rules(
      m.tournament_id,
      p_score,
      p_winner_group_player_id,
      m.player_a_id,
      m.player_b_id
    );
  end if;

  log_action := case when m.status = 'score_disputed' then 'player_resubmit_after_dispute' else 'player_a_submit' end;

  update public.matches
  set
    score_raw = case when p_result_type = 'normal' then p_score else score_raw end,
    winner_id = case when p_result_type = 'normal' then p_winner_group_player_id else winner_id end,
    result_type = coalesce(nullif(p_result_type, ''), 'normal'),
    status = 'score_submitted',
    score_submitted_by = uid,
    score_submitted_at = now(),
    opponent_confirmed_by = null,
    opponent_confirmed_at = null,
    dispute_reason = null,
    updated_by = uid,
    updated_at = now(),
    locked_at = coalesce(locked_at, now())
  where id = p_match_id;

  insert into public.match_score_logs (
    match_id, action_type, previous_score_json, new_score_json, new_status, changed_by, previous_status
  ) values (
    p_match_id,
    log_action,
    m.score_raw,
    p_score,
    'score_submitted',
    uid,
    m.status
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Jugador B: aceptar o rechazar
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Admin: fija marcador y estado
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_match_result(
  p_match_id uuid,
  p_score jsonb,
  p_winner_id uuid,
  p_status text,
  p_result_type text default 'normal'
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
    'scheduled',
    'ready_for_score',
    'score_submitted',
    'score_disputed',
    'player_confirmed',
    'admin_validated',
    'closed',
    'cancelled'
  ) then
    raise exception 'Estado inválido';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Partido no encontrado';
  end if;

  update public.matches
  set
    score_raw = p_score,
    winner_id = p_winner_id,
    result_type = p_result_type,
    status = p_status,
    updated_by = uid,
    updated_at = now(),
    locked_at = case
      when p_status in ('score_submitted', 'player_confirmed', 'admin_validated', 'closed') then coalesce(locked_at, now())
      else locked_at
    end,
    admin_validated_by = case
      when p_status in ('admin_validated', 'closed') then uid
      when p_status in ('scheduled', 'ready_for_score', 'score_submitted', 'score_disputed') then null
      else admin_validated_by
    end,
    admin_validated_at = case
      when p_status in ('admin_validated', 'closed') then now()
      when p_status in ('scheduled', 'ready_for_score', 'score_submitted', 'score_disputed') then null
      else admin_validated_at
    end,
    closed_at = case
      when p_status = 'closed' then now()
      when p_status in ('scheduled', 'ready_for_score', 'score_submitted', 'score_disputed', 'player_confirmed', 'admin_validated', 'cancelled') then null
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

-- ---------------------------------------------------------------------------
-- Admin: reabrir tras cierre (vuelve a esperar confirmación del rival)
-- ---------------------------------------------------------------------------
create or replace function public.admin_reopen_match_result(p_match_id uuid)
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

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Partido no encontrado';
  end if;

  if m.status not in ('closed', 'admin_validated') then
    raise exception 'Solo se reabren partidos validados o cerrados';
  end if;

  update public.matches
  set
    status = 'score_submitted',
    opponent_confirmed_by = null,
    opponent_confirmed_at = null,
    admin_validated_by = null,
    admin_validated_at = null,
    closed_at = null,
    dispute_reason = null,
    updated_by = uid,
    updated_at = now()
  where id = p_match_id;

  insert into public.match_score_logs (
    match_id, action_type, previous_score_json, new_score_json, new_status, changed_by, previous_status
  ) values (
    p_match_id,
    'admin_reopen',
    m.score_raw,
    m.score_raw,
    'score_submitted',
    uid,
    m.status
  );
end;
$$;

grant execute on function public.admin_reopen_match_result(uuid) to authenticated;

comment on table public.matches is
  'Ciclo: scheduled → ready_for_score → score_submitted (A) → player_confirmed (B) o score_disputed → admin_validated/closed. Ranking oficial solo en closed.';
