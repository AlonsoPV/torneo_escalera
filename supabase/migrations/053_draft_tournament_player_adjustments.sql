-- Ajustes de torneo borrador: jugadores fijos, altas/bajas y movimientos de rebalanceo.

alter table public.group_players
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_reason text,
  add column if not exists entry_type text not null default 'carryover';

alter table public.group_players
  drop constraint if exists group_players_entry_type_check;

alter table public.group_players
  add constraint group_players_entry_type_check
  check (entry_type in ('carryover', 'new_entry', 'manual_entry'));

comment on column public.group_players.is_locked is
  'Jugador fijo en un torneo draft: el rebalanceo automatico no debe moverlo.';
comment on column public.group_players.locked_reason is
  'Motivo del bloqueo, por ejemplo admin_placed_new_player.';
comment on column public.group_players.entry_type is
  'Origen de la fila: carryover, new_entry o manual_entry.';

alter table public.tournament_movements
  add column if not exists removed_by_admin_id uuid references public.profiles (id) on delete set null,
  add column if not exists removed_at timestamptz,
  add column if not exists applied_by_admin_id uuid references public.profiles (id) on delete set null,
  add column if not exists applied_at timestamptz;

alter table public.tournament_movements
  drop constraint if exists tournament_movements_movement_type_check;

alter table public.tournament_movements
  add constraint tournament_movements_movement_type_check
  check (
    movement_type in (
      'promote',
      'stay',
      'demote',
      'capped_top',
      'capped_bottom',
      'player_removed',
      'new_entry',
      'rebalance_up',
      'rebalance_down'
    )
  );

create or replace function public.enforce_group_max_players()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int;
  n int;
  locked_n int;
  tournament_status text;
begin
  select g.max_players, t.status
    into cap, tournament_status
  from public.groups g
  join public.tournaments t on t.id = g.tournament_id
  where g.id = new.group_id;

  select count(*)::int into n
  from public.group_players gp
  where gp.group_id = new.group_id;

  select count(*)::int into locked_n
  from public.group_players gp
  where gp.group_id = new.group_id
    and gp.is_locked = true;

  if tg_op = 'INSERT' then
    n := n + 1;
    if new.is_locked then
      locked_n := locked_n + 1;
    end if;
  end if;

  if n > cap then
    if tournament_status = 'draft'
      and new.is_locked = true
      and new.locked_reason = 'admin_placed_new_player'
      and locked_n <= cap
    then
      return new;
    end if;
    raise exception 'El grupo alcanzó el máximo de % jugadores', cap;
  end if;

  return new;
end;
$$;
