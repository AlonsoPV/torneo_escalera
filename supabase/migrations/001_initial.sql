-- Tennis tournament app — initial schema + RLS (MVP)
-- Run in Supabase SQL editor or via CLI migrations.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'player'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Tournaments & rules
-- ---------------------------------------------------------------------------
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  status text not null default 'draft' check (status in ('draft', 'active', 'finished')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.tournament_rules (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  best_of_sets int not null default 3 check (best_of_sets in (1, 3, 5)),
  set_points int not null default 6 check (set_points > 0),
  tiebreak_enabled boolean not null default true,
  super_tiebreak_final_set boolean not null default false,
  points_per_win int not null default 3 check (points_per_win >= 0),
  points_per_loss int not null default 0 check (points_per_loss >= 0),
  tiebreak_criteria jsonb,
  allow_player_score_entry boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tournament_id)
);

-- ---------------------------------------------------------------------------
-- Groups & players
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table public.group_players (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  seed_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index group_players_group_id_idx on public.group_players (group_id);

-- ---------------------------------------------------------------------------
-- Matches (single row per pairing in a group)
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  player_a_id uuid not null references public.group_players (id) on delete cascade,
  player_b_id uuid not null references public.group_players (id) on delete cascade,
  player_a_user_id uuid not null references public.profiles (id) on delete cascade,
  player_b_user_id uuid not null references public.profiles (id) on delete cascade,
  score_raw jsonb,
  winner_id uuid references public.group_players (id),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'corrected')),
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locked_at timestamptz,
  check (player_a_id <> player_b_id)
);

create unique index matches_group_pair_unique on public.matches (
  group_id,
  least(player_a_id::text, player_b_id::text),
  greatest(player_a_id::text, player_b_id::text)
);

create index matches_group_id_idx on public.matches (group_id);

create or replace function public.set_matches_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.set_matches_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers for RLS
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
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.can_read_tournament(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1 from public.tournaments t
      where t.id = tid
        and (
          t.status in ('active', 'finished')
          or t.created_by = auth.uid()
        )
    );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_rules enable row level security;
alter table public.groups enable row level security;
alter table public.group_players enable row level security;
alter table public.matches enable row level security;

-- Profiles
create policy profiles_select_own_or_admin
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_update_role
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Tournaments
create policy tournaments_select_visible
  on public.tournaments for select
  to authenticated
  using (public.can_read_tournament(id));

create policy tournaments_insert_admin
  on public.tournaments for insert
  to authenticated
  with check (public.is_admin());

create policy tournaments_update_admin_or_owner_draft
  on public.tournaments for update
  to authenticated
  using (
    public.is_admin()
    or (created_by = auth.uid() and status = 'draft')
  )
  with check (
    public.is_admin()
    or (created_by = auth.uid() and status = 'draft')
  );

create policy tournaments_delete_admin
  on public.tournaments for delete
  to authenticated
  using (public.is_admin());

-- Rules
create policy tournament_rules_select
  on public.tournament_rules for select
  to authenticated
  using (public.can_read_tournament(tournament_id));

create policy tournament_rules_write_admin
  on public.tournament_rules for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Groups
create policy groups_select
  on public.groups for select
  to authenticated
  using (public.can_read_tournament(tournament_id));

create policy groups_write_admin
  on public.groups for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Group players
create policy group_players_select
  on public.group_players for select
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_id and public.can_read_tournament(g.tournament_id)
    )
  );

create policy group_players_write_admin
  on public.group_players for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Matches
create policy matches_select
  on public.matches for select
  to authenticated
  using (public.can_read_tournament(tournament_id));

create policy matches_insert_admin
  on public.matches for insert
  to authenticated
  with check (public.is_admin());

create policy matches_update_admin
  on public.matches for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy matches_update_player_pending
  on public.matches for update
  to authenticated
  using (
    not public.is_admin()
    and status = 'pending'
    and (player_a_user_id = auth.uid() or player_b_user_id = auth.uid())
    and exists (
      select 1
      from public.tournament_rules r
      where r.tournament_id = matches.tournament_id
        and r.allow_player_score_entry = true
    )
  )
  with check (
    not public.is_admin()
    and status in ('pending', 'confirmed')
    and (player_a_user_id = auth.uid() or player_b_user_id = auth.uid())
  );

-- Note: MVP uses two UPDATE policies for matches (admin + player). Postgres ORs them.
-- Hardening: split player transition to confirmed via RPC/trigger only.

comment on table public.matches is 'RLS MVP: players may update only while status=pending; app sets confirmed+locked_at. Admin bypasses via matches_update_admin.';
