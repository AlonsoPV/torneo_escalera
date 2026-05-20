-- Victoria por default: +3 (alineado con victoria jugada cuando points_per_win = 3).
-- Derrota jugada por defecto en BD: +1 para inserts mínimos (solo tournament_id).
-- Actualiza filas que seguían el paquete recomendado anterior (3 / 1 / victoria default 2).

alter table public.tournament_rules
  alter column points_default_win set default 3;

alter table public.tournament_rules
  alter column points_per_loss set default 1;

update public.tournament_rules
set points_default_win = 3
where points_default_win = 2
  and points_per_win = 3
  and points_per_loss = 1;
