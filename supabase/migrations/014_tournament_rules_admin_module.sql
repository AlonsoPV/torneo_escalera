-- Admin rules module: audit fields, defaults workflow, ranking criteria, format flags.
--
-- Depends on: public.tournament_rules from 001_initial.sql (and public.profiles).
-- If you see "relation tournament_rules does not exist", apply migrations in order from 001,
-- or run: supabase db reset   (local) / push the full migration chain (hosted).

do $guard$
begin
  if to_regclass('public.tournament_rules') is null then
    raise exception
      'public.tournament_rules does not exist. Apply supabase/migrations/001_initial.sql (and prior migrations) before 014_tournament_rules_admin_module.sql.';
  end if;
end
$guard$;

alter table public.tournament_rules
  add column if not exists updated_at timestamptz not null default now();

alter table public.tournament_rules
  add column if not exists updated_by uuid references public.profiles (id);

alter table public.tournament_rules
  add column if not exists defaults_enabled boolean not null default true;

alter table public.tournament_rules
  add column if not exists default_requires_admin_review boolean not null default true;

alter table public.tournament_rules
  add column if not exists player_can_report_default boolean not null default true;

alter table public.tournament_rules
  add column if not exists admin_can_set_default_manual boolean not null default true;

alter table public.tournament_rules
  add column if not exists result_submission_window_hours int not null default 48
    check (result_submission_window_hours >= 1 and result_submission_window_hours <= 720);

alter table public.tournament_rules
  add column if not exists auto_penalty_no_show boolean not null default false;

alter table public.tournament_rules
  add column if not exists allow_7_6 boolean not null default true;

alter table public.tournament_rules
  add column if not exists allow_7_5 boolean not null default true;

alter table public.tournament_rules
  add column if not exists ranking_criteria jsonb not null default '[
    {"id":"points","label":"Puntos","enabled":true},
    {"id":"wins","label":"Partidos ganados","enabled":true},
    {"id":"set_diff","label":"Diferencia de sets","enabled":true},
    {"id":"game_diff","label":"Diferencia de games","enabled":true},
    {"id":"h2h","label":"Enfrentamiento directo","enabled":true}
  ]'::jsonb;

update public.tournament_rules
set updated_at = coalesce(updated_at, created_at)
where true;

create or replace function public.set_tournament_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_tournament_rules_updated_at on public.tournament_rules;
create trigger trg_tournament_rules_updated_at
  before update on public.tournament_rules
  for each row execute function public.set_tournament_rules_updated_at();
