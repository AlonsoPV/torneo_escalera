-- Asegurar que el check de points_per_loss permita negativos (por si migración 026 no aplicó o el nombre del constraint difiere).

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'tournament_rules'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%points_per_loss%'
  loop
    execute format('alter table public.tournament_rules drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.tournament_rules
  drop constraint if exists tournament_rules_points_per_loss_check;

alter table public.tournament_rules
  add constraint tournament_rules_points_per_loss_check
  check (points_per_loss >= -50 and points_per_loss <= 50);

comment on constraint tournament_rules_points_per_loss_check on public.tournament_rules is
  'Puntos por derrota pueden ser negativos (rango acotado al formulario admin).';
