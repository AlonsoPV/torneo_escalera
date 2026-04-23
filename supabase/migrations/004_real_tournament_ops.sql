-- Real tournament operations: roles, schedule, match lifecycle, score logs, constraints

-- ---------------------------------------------------------------------------
-- Profiles: extend roles (super_admin, future captain/referee)
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('player', 'admin', 'super_admin', 'captain', 'referee'));

-- ---------------------------------------------------------------------------
-- Tournaments: season
-- ---------------------------------------------------------------------------
alter table public.tournaments add column if not exists season text;

-- ---------------------------------------------------------------------------
-- Groups: max players (max 5)
-- ---------------------------------------------------------------------------
alter table public.groups
  add column if not exists max_players int not null default 5
    check (max_players >= 2 and max_players <= 5);

-- ---------------------------------------------------------------------------
-- Tournament rules: default (forfeit) points
-- ---------------------------------------------------------------------------
alter table public.tournament_rules
  add column if not exists points_default_win int not null default 2 check (points_default_win >= 0);
alter table public.tournament_rules
  add column if not exists points_default_loss int not null default -1;

-- Ensure normal match points match product spec (3 / 1) if still at old defaults
update public.tournament_rules
set points_per_win = 3, points_per_loss = 1
where points_per_win = 3 and points_per_loss = 0;

update public.tournament_rules
set points_per_loss = 1
where points_per_loss = 0;

-- ---------------------------------------------------------------------------
-- Matches: schedule, result type, confirmation, expanded status
-- ---------------------------------------------------------------------------
alter table public.matches add column if not exists scheduled_date date;
alter table public.matches add column if not exists scheduled_start_at timestamptz;
alter table public.matches add column if not exists scheduled_end_at timestamptz;
alter table public.matches add column if not exists location text;
alter table public.matches add column if not exists result_type text;
update public.matches set result_type = 'normal' where result_type is null;
alter table public.matches alter column result_type set default 'normal';
alter table public.matches alter column result_type set not null;
alter table public.matches drop constraint if exists matches_result_type_check;
alter table public.matches
  add constraint matches_result_type_check
  check (result_type in ('normal', 'default_win_a', 'default_win_b'));
alter table public.matches add column if not exists confirmed_at timestamptz;
alter table public.matches add column if not exists confirmed_by uuid references public.profiles (id);

alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches
  add constraint matches_status_check
  check (
    status in (
      'pending',
      'scheduled',
      'ready_for_result',
      'result_submitted',
      'confirmed',
      'corrected',
      'cancelled'
    )
  );

-- Map legacy rows (only had pending, confirmed, corrected) — all valid in new check

-- ---------------------------------------------------------------------------
-- match_score_logs
-- ---------------------------------------------------------------------------
create table if not exists public.match_score_logs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  action_type text not null,
  previous_score_json jsonb,
  new_score_json jsonb,
  previous_status text,
  new_status text,
  changed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists match_score_logs_match_id_idx on public.match_score_logs (match_id);

-- ---------------------------------------------------------------------------
-- is_admin() includes super_admin
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- Enforce: at most one group per user per tournament
-- ---------------------------------------------------------------------------
create or replace function public.enforce_user_single_group_per_tournament()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  other_cnt int;
begin
  select g.tournament_id into tid
  from public.groups g
  where g.id = new.group_id;

  if tg_op = 'INSERT' then
    select count(*)::int into other_cnt
    from public.group_players gp
    join public.groups g on g.id = gp.group_id
    where gp.user_id = new.user_id and g.tournament_id = tid;
    if other_cnt > 0 then
      raise exception 'El jugador ya está inscrito en un grupo de este torneo';
    end if;
  else
    select count(*)::int into other_cnt
    from public.group_players gp
    join public.groups g on g.id = gp.group_id
    where gp.user_id = new.user_id
      and g.tournament_id = tid
      and gp.id <> new.id;
    if other_cnt > 0 then
      raise exception 'El jugador ya está inscrito en otro grupo de este torneo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_group_players_one_per_tournament on public.group_players;
create trigger trg_group_players_one_per_tournament
  before insert or update of group_id, user_id on public.group_players
  for each row
  execute function public.enforce_user_single_group_per_tournament();

-- ---------------------------------------------------------------------------
-- Enforce: max_players per group
-- ---------------------------------------------------------------------------
create or replace function public.enforce_group_max_players()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int;
  n int;
begin
  select g.max_players into cap
  from public.groups g
  where g.id = new.group_id;

  select count(*) into n from public.group_players gp where gp.group_id = new.group_id;
  if tg_op = 'INSERT' then
    n := n + 1;
  end if;
  if n > cap then
    raise exception 'El grupo alcanzó el máximo de % jugadores', cap;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_group_players_max on public.group_players;
-- BEFORE INSERT: count +1
create trigger trg_group_players_max
  before insert on public.group_players
  for each row
  execute function public.enforce_group_max_players();

-- ---------------------------------------------------------------------------
-- Helpers: match time window
-- ---------------------------------------------------------------------------
create or replace function public.match_time_window_ok(m public.matches)
returns boolean
language sql
stable
as $$
  select m.scheduled_end_at is not null and m.scheduled_end_at < now();
$$;

-- ---------------------------------------------------------------------------
-- submit_player_match_result: validates window + participant, sets result_submitted
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
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Partido no encontrado';
  end if;

  if m.player_a_user_id <> uid and m.player_b_user_id <> uid then
    raise exception 'No participas en este partido';
  end if;

  if not exists (
    select 1 from public.tournament_rules r
    where r.tournament_id = m.tournament_id
      and r.allow_player_score_entry = true
  ) then
    raise exception 'La captura de marcador por jugadores no está habilitada para este torneo';
  end if;

  if public.is_admin() then
    raise exception 'Usa el flujo de administrador para editar';
  end if;

  if m.status in ('confirmed', 'corrected', 'cancelled') then
    raise exception 'El partido no admite envío de jugador en este estado';
  end if;

  if m.status = 'result_submitted' then
    raise exception 'El resultado ya fue enviado. Contacta al staff si necesitas corregirlo.';
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
    if m.scheduled_end_at is null then
      raise exception 'El partido no tiene hora de fin; el organizador debe agendarlo';
    end if;
    if m.scheduled_end_at >= now() then
      raise exception 'Aún no puedes registrar el resultado (debe pasar la hora de fin)';
    end if;
  end if;
  -- default wins: no time check for MVP, admin should set; player path for default can be added later

  if m.status not in ('pending', 'scheduled', 'ready_for_result') then
    raise exception 'Estado de partido no válido para envío';
  end if;

  update public.matches
  set
    score_raw = case when p_result_type = 'normal' then p_score else score_raw end,
    winner_id = case when p_result_type = 'normal' then p_winner_group_player_id else winner_id end,
    result_type = coalesce(nullif(p_result_type, ''), 'normal'),
    status = 'result_submitted',
    updated_by = uid,
    updated_at = now(),
    locked_at = coalesce(locked_at, now())
  where id = p_match_id;

  insert into public.match_score_logs (
    match_id, action_type, previous_score_json, new_score_json, new_status, changed_by, previous_status
  ) values (
    p_match_id,
    'player_submit',
    m.score_raw,
    p_score,
    'result_submitted',
    uid,
    m.status
  );
end;
$$;

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
    locked_at = case when p_status in ('confirmed', 'corrected', 'result_submitted') then coalesce(locked_at, now()) else locked_at end,
    confirmed_at = case when p_status in ('confirmed', 'corrected') then now() else confirmed_at end,
    confirmed_by = case when p_status in ('confirmed', 'corrected') then uid else confirmed_by end
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

grant execute on function public.submit_player_match_result(uuid, jsonb, text, uuid) to authenticated;
grant execute on function public.admin_set_match_result(uuid, jsonb, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: match_score_logs
-- ---------------------------------------------------------------------------
alter table public.match_score_logs enable row level security;

create policy match_score_logs_select
  on public.match_score_logs for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.player_a_user_id = auth.uid() or m.player_b_user_id = auth.uid())
    )
  );

-- Inserts en logs: solo via funciones security definer (sin policy de insert = deniega cliente)

-- ---------------------------------------------------------------------------
-- Partidos: quitar update directo de jugadores; solo RPC o admin
-- (Postgres aplica OR entre políticas; al eliminar la de jugador, el cliente
-- ya no puede hacer update salvo is_admin o bypass por función definer)
-- ---------------------------------------------------------------------------
drop policy if exists matches_update_player_pending on public.matches;

-- ---------------------------------------------------------------------------
-- match_ready_for_result: true cuando ya pasó la ventana y el estado aún no está cerrado
-- ---------------------------------------------------------------------------
create or replace function public.match_ready_for_result(m public.matches)
returns boolean
language sql
stable
as $$
  select
    m.scheduled_end_at is not null
    and m.scheduled_end_at < now()
    and m.status in ('pending', 'scheduled', 'ready_for_result');
$$;

comment on table public.match_score_logs is
  'Auditoría de resultados. INSERT solo vía funciones security definer (el rol postgres suele bypasear RLS al insertar desde esas funciones; clientes con anon/authenticated: solo SELECT vía match_score_logs_select).';
comment on table public.matches is
  'Ciclo de estado: agendar (scheduled) → ventana (RPC submit_player tras fin) result_submitted → staff confirma confirmed/corrected. Jugadores no hacen UPDATE directo: usar submit_player_match_result.';