-- Categorías de grupo por torneo (Primera División, Liga de Ascenso, etc.)

create table if not exists public.group_categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  unique (tournament_id, name)
);

create index if not exists group_categories_tournament_id_idx
  on public.group_categories (tournament_id);

alter table public.groups
  add column if not exists group_category_id uuid references public.group_categories (id) on delete set null;

create index if not exists groups_group_category_id_idx on public.groups (group_category_id);

alter table public.group_categories enable row level security;

create policy group_categories_select
  on public.group_categories for select
  to authenticated
  using (public.can_read_tournament(tournament_id));

create policy group_categories_write_admin
  on public.group_categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Tres categorías iniciales por cada torneo existente (idempotente)
insert into public.group_categories (tournament_id, name, order_index)
select t.id, x.name, x.ord
from public.tournaments t
cross join (
  values
    ('Primera División', 0),
    ('Liga de Ascenso', 1),
    ('Fuerzas básicas', 2)
) as x(name, ord)
on conflict (tournament_id, name) do nothing;

comment on table public.group_categories is
  'Clasificación de grupos dentro del torneo (ej. división). Los grupos enlazan opcionalmente vía groups.group_category_id.';
