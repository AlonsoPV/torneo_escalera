-- Auditoría de importación masiva de resultados (1 fila CSV = 1 partido).
-- La verdad operativa sigue en public.matches; aquí solo lotes y resultado por fila.

create table if not exists public.match_results_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  total_rows int not null default 0,
  success_rows int not null default 0,
  error_rows int not null default 0,
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.match_results_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.match_results_import_batches (id) on delete cascade,
  row_number int not null,
  status text not null check (status in ('success', 'error')),
  error_message text,
  match_id uuid references public.matches (id) on delete set null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists match_results_import_rows_batch_id_idx
  on public.match_results_import_rows (batch_id);

alter table public.match_results_import_batches enable row level security;
alter table public.match_results_import_rows enable row level security;

drop policy if exists match_results_import_batches_admin_all on public.match_results_import_batches;
create policy match_results_import_batches_admin_all
  on public.match_results_import_batches for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists match_results_import_rows_admin_all on public.match_results_import_rows;
create policy match_results_import_rows_admin_all
  on public.match_results_import_rows for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.match_results_import_batches is
  'Lotes de carga masiva de marcadores (CSV).';
comment on table public.match_results_import_rows is
  'Detalle por fila importada: éxito/error y partido afectado.';
