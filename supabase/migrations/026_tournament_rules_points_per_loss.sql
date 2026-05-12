-- Alinear con el editor de reglas (Zod: points_per_loss hasta -50) y el modelo de producto (p. ej. 3 / −1).

alter table public.tournament_rules
  drop constraint if exists tournament_rules_points_per_loss_check;

alter table public.tournament_rules
  add constraint tournament_rules_points_per_loss_check
  check (points_per_loss >= -50 and points_per_loss <= 50);

comment on constraint tournament_rules_points_per_loss_check on public.tournament_rules is
  'Permite penalización por derrota (valores negativos), acotado al rango del formulario admin.';
