-- Garantizar columnas de auditoría en tournament_rules
-- (evita PostgREST: "Could not find the 'updated_by' column ... in the schema cache").
-- Idempotente: seguro si 014 u otras migraciones ya corrieron.

alter table public.tournament_rules
  add column if not exists updated_at timestamptz not null default now();

alter table public.tournament_rules
  add column if not exists updated_by uuid references public.profiles (id);

comment on column public.tournament_rules.updated_by is
  'Perfil que actualizó por último las reglas del torneo (UI admin).';
comment on column public.tournament_rules.updated_at is
  'Marca de tiempo de la última actualización de la fila de reglas.';

-- Refrescar caché de PostgREST (evita PGRST hasta el próximo reinicio).
notify pgrst, 'reload schema';
