-- Cierre formal del torneo (snapshot de standings) y movimientos enriquecidos para el siguiente torneo.

alter table public.tournaments
  add column if not exists finished_at timestamptz,
  add column if not exists closed_by uuid references public.profiles (id) on delete set null;

comment on column public.tournaments.finished_at is
  'Momento en que el staff cerró el torneo vía flujo administrativo.';
comment on column public.tournaments.closed_by is
  'Perfil del administrador que ejecutó el cierre.';

alter table public.tournament_movements
  add column if not exists to_group_id uuid references public.groups (id) on delete set null,
  add column if not exists from_group_order_index int,
  add column if not exists to_group_order_index int,
  add column if not exists movement_reason text;

comment on column public.tournament_movements.movement_reason is
  'Motivo semántico: top_2_promote | third_stays | bottom_2_demote | top_group_limit | bottom_group_limit.';

create table if not exists public.tournament_final_standings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  group_order_index int not null,
  player_id uuid not null references public.profiles (id) on delete cascade,
  position int not null,
  points int not null default 0,
  games_for int not null default 0,
  games_against int not null default 0,
  games_difference int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  created_at timestamptz not null default now(),
  constraint tournament_final_standings_unique unique (tournament_id, group_id, player_id)
);

create index if not exists tournament_final_standings_tournament_idx
  on public.tournament_final_standings (tournament_id);

create index if not exists tournament_final_standings_group_idx
  on public.tournament_final_standings (group_id);

comment on table public.tournament_final_standings is
  'Snapshot de clasificación por grupo al cerrar el torneo (siguiente torneo no depende de cambios posteriores).';

alter table public.tournament_final_standings enable row level security;

create policy tournament_final_standings_select_admin
  on public.tournament_final_standings for select
  to authenticated
  using (public.is_admin());

create policy tournament_final_standings_insert_admin
  on public.tournament_final_standings for insert
  to authenticated
  with check (public.is_admin());

create policy tournament_final_standings_delete_admin
  on public.tournament_final_standings for delete
  to authenticated
  using (public.is_admin());
