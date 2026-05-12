-- Sesiones inactivas: reforzar RLS cuando profiles.status = 'inactive'.
-- is_admin() y lectura de torneos/datos exigen perfil activo; el propio perfil sigue siendo legible.

create or replace function public.auth_session_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.status = 'active' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

comment on function public.auth_session_is_active() is
  'True si el usuario autenticado tiene profiles.status = active (security definer; uso en RLS).';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.can_read_tournament(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or (
      public.auth_session_is_active()
      and exists (
        select 1 from public.tournaments t
        where t.id = tid
          and (
            t.status in ('active', 'finished')
            or t.created_by = auth.uid()
          )
      )
    );
$$;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid() and public.auth_session_is_active())
  with check (id = auth.uid() and public.auth_session_is_active());

drop policy if exists tournaments_update_admin_or_owner_draft on public.tournaments;
create policy tournaments_update_admin_or_owner_draft
  on public.tournaments for update
  to authenticated
  using (
    public.is_admin()
    or (
      created_by = auth.uid()
      and status = 'draft'
      and public.auth_session_is_active()
    )
  )
  with check (
    public.is_admin()
    or (
      created_by = auth.uid()
      and status = 'draft'
      and public.auth_session_is_active()
    )
  );

drop policy if exists match_score_logs_select on public.match_score_logs;
create policy match_score_logs_select
  on public.match_score_logs for select
  to authenticated
  using (
    public.is_admin()
    or (
      public.auth_session_is_active()
      and exists (
        select 1 from public.matches m
        where m.id = match_id
          and (m.player_a_user_id = auth.uid() or m.player_b_user_id = auth.uid())
      )
    )
  );

drop policy if exists player_categories_select_authenticated on public.player_categories;
create policy player_categories_select_authenticated
  on public.player_categories for select
  to authenticated
  using (public.auth_session_is_active());
