-- Victoria por DEF / W.O. / default_win: +3 ganador, −1 perdedor (cómputo retroactivo al leer tournament_rules).
-- Re-alinea torneos en paquete estándar 3/1 que quedaron en +2 tras migración 035.

alter table public.tournament_rules
  alter column points_default_win set default 3;

update public.tournament_rules
set points_default_win = 3
where points_default_win = 2
  and points_default_loss = -1
  and points_per_win = 3
  and points_per_loss = 1;
