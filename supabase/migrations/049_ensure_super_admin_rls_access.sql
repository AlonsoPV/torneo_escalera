-- Asegura que el rol super_admin tenga acceso real bajo RLS.
-- Si una base remota se quedó con la función inicial, el frontend puede mostrar
-- el layout admin pero las consultas devuelven vacío/errores por políticas.

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

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
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
        select 1
        from public.tournaments t
        where t.id = tid
          and (
            t.status in ('active', 'finished')
            or t.created_by = auth.uid()
          )
      )
    );
$$;
