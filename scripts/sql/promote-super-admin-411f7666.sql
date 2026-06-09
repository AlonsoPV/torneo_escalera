-- =============================================================================
-- Promover a super_admin al usuario 411f7666-d1e9-4424-9de8-d7d31747931b
--
-- Ejecutar en: Supabase Dashboard → SQL Editor (rol postgres / service).
--
-- Requisitos:
--   - El UUID debe existir en auth.users (cuenta ya creada).
--   - Migración 004 aplicada (role admite super_admin).
--
-- Idempotente: puede ejecutarse varias veces.
-- =============================================================================

do $$
declare
  v_user_id uuid := '411f7666-d1e9-4424-9de8-d7d31747931b';
  v_auth_email text;
  v_full_name text;
begin
  select u.email,
         coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
    into v_auth_email, v_full_name
  from auth.users u
  where u.id = v_user_id;

  if v_auth_email is null then
    raise exception 'No existe auth.users con id %', v_user_id;
  end if;

  insert into public.profiles (id, full_name, email, role, status)
  values (v_user_id, v_full_name, v_auth_email, 'super_admin', 'active')
  on conflict (id) do update
  set role = 'super_admin',
      status = 'active',
      updated_at = now();

  raise notice 'Usuario % (%) promovido a super_admin.', v_user_id, v_auth_email;
end;
$$;

-- Verificación
select id, full_name, email, phone, role, status, updated_at
from public.profiles
where id = '411f7666-d1e9-4424-9de8-d7d31747931b';
