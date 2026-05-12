-- Siguiente torneo: vínculo entre torneos, etiqueta de periodo y auditoría de ascensos/descensos.

alter table public.tournaments
  add column if not exists previous_tournament_id uuid references public.tournaments (id) on delete set null;

alter table public.tournaments
  add column if not exists period_label text;

create index if not exists tournaments_previous_tournament_id_idx
  on public.tournaments (previous_tournament_id);

comment on column public.tournaments.previous_tournament_id is
  'Torneo del cual deriva este torneo (wizard “siguiente torneo”).';
comment on column public.tournaments.period_label is
  'Etiqueta legible del periodo (ej. mes/año) para el torneo nuevo.';

create table if not exists public.tournament_movements (
  id uuid primary key default gen_random_uuid(),
  from_tournament_id uuid not null references public.tournaments (id) on delete cascade,
  to_tournament_id uuid not null references public.tournaments (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  from_category_id uuid references public.group_categories (id) on delete set null,
  to_category_id uuid references public.group_categories (id) on delete set null,
  from_group_id uuid references public.groups (id) on delete set null,
  from_position int not null,
  points int not null default 0,
  games_for int not null default 0,
  games_difference int not null default 0,
  movement_type text not null
    check (movement_type in ('promote', 'stay', 'demote', 'capped_top', 'capped_bottom')),
  raw_movement text,
  created_at timestamptz not null default now()
);

create index if not exists tournament_movements_player_created_idx
  on public.tournament_movements (player_id, created_at desc);

create index if not exists tournament_movements_to_tournament_idx
  on public.tournament_movements (to_tournament_id);

create index if not exists tournament_movements_from_tournament_idx
  on public.tournament_movements (from_tournament_id);

comment on table public.tournament_movements is
  'Movimiento de un jugador entre torneos/categorías al crear el torneo siguiente desde resultados.';

alter table public.tournament_movements enable row level security;

create policy tournament_movements_select
  on public.tournament_movements for select
  to authenticated
  using (
    public.is_admin()
    or (
      player_id = auth.uid()
      and (
        public.can_read_tournament(from_tournament_id)
        or public.can_read_tournament(to_tournament_id)
      )
    )
  );

create policy tournament_movements_insert_admin
  on public.tournament_movements for insert
  to authenticated
  with check (public.is_admin());

create policy tournament_movements_update_admin
  on public.tournament_movements for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy tournament_movements_delete_admin
  on public.tournament_movements for delete
  to authenticated
  using (public.is_admin());
