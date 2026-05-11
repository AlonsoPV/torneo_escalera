-- Perfiles: categoría, ID externo, estado, control de auto-inscripción (importación masiva)
-- Tablas: player_categories (clasificación del jugador), bulk import audit

create table if not exists public.player_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists player_categories_name_normalized_unique
  on public.player_categories (lower(trim(name)));

alter table public.profiles
  add column if not exists external_id text,
  add column if not exists category_id uuid references public.player_categories (id) on delete set null,
  add column if not exists status text not null default 'active',
  add column if not exists auto_enroll_eligible boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check check (status in ('active', 'inactive'));

create unique index if not exists profiles_external_id_unique
  on public.profiles (external_id)
  where external_id is not null;

create or replace function public.player_categories_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_player_categories_updated_at on public.player_categories;
create trigger trg_player_categories_updated_at
  before update on public.player_categories
  for each row execute function public.player_categories_set_updated_at();

create or replace function public.profiles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.profiles_set_updated_at();

-- ---------------------------------------------------------------------------
-- Auditoría de importación
-- ---------------------------------------------------------------------------
create table if not exists public.bulk_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  total_rows int not null default 0,
  success_rows int not null default 0,
  error_rows int not null default 0,
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.bulk_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.bulk_import_batches (id) on delete cascade,
  row_number int not null,
  external_id text,
  full_name text,
  role text,
  group_name text,
  category_name text,
  status text not null check (status in ('success', 'error')),
  error_message text,
  created_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists bulk_import_rows_batch_id_idx on public.bulk_import_rows (batch_id);

-- ---------------------------------------------------------------------------
-- Trigger auth: perfiles nuevos con metadata bulk_import
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, email, role, auto_enroll_eligible
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    'player',
    case when coalesce(new.raw_user_meta_data->>'bulk_import', '') = 'true' then false else true end
  );
  return new;
end;
$$;

create or replace function public.profiles_after_insert_auto_enroll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from 'player' then
    return new;
  end if;
  if coalesce(new.auto_enroll_eligible, true) is false then
    return new;
  end if;
  begin
    perform public.enroll_user_in_open_groups(
      new.id,
      coalesce(
        new.full_name,
        split_part(new.email, '@', 1),
        'Jugador'
      )
    );
  exception
    when others then
      raise warning 'enroll_user_in_open_groups( % ): %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.player_categories enable row level security;

drop policy if exists player_categories_select_authenticated on public.player_categories;
create policy player_categories_select_authenticated
  on public.player_categories for select
  to authenticated
  using (true);

drop policy if exists player_categories_write_admin on public.player_categories;
create policy player_categories_write_admin
  on public.player_categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.bulk_import_batches enable row level security;
alter table public.bulk_import_rows enable row level security;

drop policy if exists bulk_import_batches_admin_all on public.bulk_import_batches;
create policy bulk_import_batches_admin_all
  on public.bulk_import_batches for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists bulk_import_rows_admin_all on public.bulk_import_rows;
create policy bulk_import_rows_admin_all
  on public.bulk_import_rows for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.player_categories is
  'Categoría del jugador (ej. Varonil, Femenil). Distinta de group_categories (división de grupos en torneo).';
comment on table public.bulk_import_batches is 'Auditoría de cargas masivas de usuarios desde admin.';
