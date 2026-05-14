-- Teléfono como identificador principal de jugadores; correo de recuperación opcional.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists email_verified boolean not null default false,
  add column if not exists must_complete_email boolean not null default true;

comment on column public.profiles.phone is
  'Número de celular normalizado (solo dígitos). Identificador principal visible para jugadores.';
comment on column public.profiles.email_verified is
  'Si el correo de recuperación fue verificado (flujo futuro / proveedor).';
comment on column public.profiles.must_complete_email is
  'Si el jugador debe registrar correo de recuperación en la app.';

-- Índices únicos parciales (varios perfiles pueden tener email/phone null durante migraciones).
drop index if exists profiles_phone_unique;
create unique index profiles_phone_unique
  on public.profiles (phone)
  where phone is not null;

drop index if exists profiles_recovery_email_lower_unique;
create unique index profiles_recovery_email_lower_unique
  on public.profiles (lower(trim(email)))
  where email is not null;

-- Datos existentes: correo real ya registrado → no exigir completar correo.
update public.profiles
set must_complete_email = false
where email is not null;

-- Usuarios con correo técnico @mega-varonil.local (parte local solo dígitos): mover a phone y limpiar perfil.email.
update public.profiles p
set
  phone = regexp_replace(split_part(p.email, '@', 1), '\D', '', 'g'),
  email = null,
  must_complete_email = true,
  email_verified = false
where p.email is not null
  and p.email ilike '%@mega-varonil.local'
  and regexp_replace(split_part(p.email, '@', 1), '\D', '', 'g') ~ '^[0-9]{10,13}$';

-- Restantes @mega-varonil.local: ocultar correo técnico del perfil; intentar teléfono desde external_id.
update public.profiles p
set
  phone = coalesce(
    p.phone,
    case
      when p.external_id is not null
        and length(regexp_replace(p.external_id, '\D', '', 'g')) between 10 and 13
      then regexp_replace(p.external_id, '\D', '', 'g')
      else null
    end
  ),
  email = null,
  must_complete_email = true,
  email_verified = false
where p.email is not null
  and p.email ilike '%@mega-varonil.local';

-- Evitar que cuentas sin admin cambien rol, correo de recuperación o teléfono desde el cliente (las Edge Functions usan service role).
create or replace function public.profiles_enforce_self_update_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.id is distinct from auth.uid() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'No puedes cambiar tu rol';
  end if;
  if new.email is distinct from old.email then
    raise exception 'El correo se actualiza desde tu panel de cuenta';
  end if;
  if new.phone is distinct from old.phone then
    raise exception 'El teléfono solo lo puede cambiar un administrador';
  end if;
  if new.status is distinct from old.status then
    raise exception 'No puedes cambiar el estado de tu cuenta';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_enforce_self_update on public.profiles;
create trigger trg_profiles_enforce_self_update
  before update on public.profiles
  for each row execute function public.profiles_enforce_self_update_limits();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_phone text;
  v_email text;
  v_role text;
  v_category uuid;
  v_external text;
  v_bulk text;
  v_must_email boolean;
begin
  v_phone := nullif(trim(meta->>'phone'), '');
  if v_phone is not null then
    v_phone := regexp_replace(v_phone, '\D', '', 'g');
    if v_phone = '' then
      v_phone := null;
    end if;
  end if;

  if v_phone is null and new.email ilike '%@mega-varonil.local' then
    v_phone := nullif(regexp_replace(split_part(new.email, '@', 1), '\D', '', 'g'), '');
  end if;

  if new.email ilike '%@mega-varonil.local' then
    v_email := null;
    v_must_email := true;
  else
    v_email := new.email;
    v_must_email := false;
  end if;

  v_role := coalesce(nullif(trim(meta->>'role'), ''), 'player');
  if v_role not in ('player', 'admin', 'super_admin', 'captain', 'referee') then
    v_role := 'player';
  end if;

  begin
    if (meta ? 'category_id')
       and nullif(trim(meta->>'category_id'), '') is not null
       and (trim(meta->>'category_id')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_category := (trim(meta->>'category_id'))::uuid;
    else
      v_category := null;
    end if;
  exception
    when others then
      v_category := null;
  end;

  v_external := nullif(trim(meta->>'external_id'), '');
  v_bulk := coalesce(meta->>'bulk_import', '');

  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    phone,
    category_id,
    external_id,
    email_verified,
    must_complete_email,
    auto_enroll_eligible,
    status
  )
  values (
    new.id,
    coalesce(nullif(trim(meta->>'full_name'), ''), split_part(new.email, '@', 1)),
    v_email,
    v_role,
    v_phone,
    v_category,
    v_external,
    false,
    v_must_email,
    case when v_bulk = 'true' then false else true end,
    'active'
  );

  return new;
end;
$$;
