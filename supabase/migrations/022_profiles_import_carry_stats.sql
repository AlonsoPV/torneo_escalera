-- Estadísticas opcionales capturadas en carga masiva (referencia manual / arrastre de torneo anterior).

alter table public.profiles
  add column if not exists import_carry_pj int,
  add column if not exists import_carry_pts int;

comment on column public.profiles.import_carry_pj is
  'Opcional: partidos jugados indicados en importación masiva (referencia, no calculado de partidos del sistema).';
comment on column public.profiles.import_carry_pts is
  'Opcional: puntos indicados en importación masiva (referencia); puede ser negativo.';
