-- Victoria por W.O./DEF por defecto del producto: +2 (alineado con TOURNAMENT_RULES.woWinPoints).
-- Corrige paquete estándar 3/1/3 introducido en 033 cuando el admin no personalizó valores.

alter table public.tournament_rules
  alter column points_default_win set default 2;

update public.tournament_rules
set points_default_win = 2
where points_default_win = 3
  and points_per_win = 3
  and points_per_loss = 1
  and points_default_loss = -1;
