-- Carga masiva sin asignación a grupo: el lote puede no estar ligado a un torneo (pool global).

alter table public.bulk_import_batches
  alter column tournament_id drop not null;
