-- =============================================================================
-- Crear en Supabase dos jugadores confirmados (Auth email_confirm):
--   RICARDO CORTÉZ  → teléfono técnico + correo 551990001001@mega-varonil.local
--   ANDRÉS GÓMEZ    → 551990001002@mega-varonil.local
--
-- Ejecutar en: Supabase Dashboard → SQL Editor (rol postgres / service).
--
-- Requisitos:
--   - Extensión pgcrypto (para bcrypt).
--   - Al menos una fila en public.player_categories (se usa la primera por name).
--
-- Ajusta antes de ejecutar:
--   - Teléfonos (deben ser únicos en public.profiles.phone).
--   - Contraseña temporal v_pass_plain (mín. 6 caracteres).
--
-- Idempotencia: si ya existe perfil con ese phone o auth.users con ese email,
-- se omite ese jugador (NOTICE).
-- =============================================================================

create extension if not exists pgcrypto;

do $$
declare
  v_cat uuid;
  v_now timestamptz := now();
  v_instance uuid := '00000000-0000-0000-0000-000000000000';
  -- Contraseña temporal (cámbiala).
  v_pass_plain text := 'Cambiar123!';
  v_pw text := crypt(v_pass_plain, gen_salt('bf'));

  r record;
  v_uid uuid;
  v_email text;
  v_meta jsonb;
begin
  select id
    into v_cat
  from public.player_categories
  order by name asc
  limit 1;

  if v_cat is null then
    raise exception 'No hay categorías en public.player_categories; crea una antes.';
  end if;

  for r in
    select *
    from (
      values
        ('551990001001'::text, 'RICARDO CORTÉZ'::text),
        ('551990001002'::text, 'ANDRÉS GÓMEZ'::text)
    ) as t(phone_digits, full_name)
  loop
    v_email := r.phone_digits || '@mega-varonil.local';

    if exists (select 1 from public.profiles p where p.phone = r.phone_digits) then
      raise notice 'Omitiendo «%»: ya existe perfil con phone=%', r.full_name, r.phone_digits;
      continue;
    end if;

    if exists (select 1 from auth.users u where u.email = v_email) then
      raise notice 'Omitiendo «%»: ya existe auth.users con email=%', r.full_name, v_email;
      continue;
    end if;

    v_uid := gen_random_uuid();

    v_meta := jsonb_build_object(
      'full_name', r.full_name,
      'phone', r.phone_digits,
      'role', 'player',
      'category_id', v_cat::text
    );

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user
    )
    values (
      v_instance,
      v_uid,
      'authenticated',
      'authenticated',
      v_email,
      v_pw,
      v_now,
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      v_now,
      v_now,
      false
    );

    -- GoTrue exige fila en identities para login por email.
    insert into auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      v_email,
      v_uid,
      jsonb_build_object(
        'sub', v_uid::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_now,
      v_now,
      v_now
    );

    -- El trigger handle_new_user crea el perfil; alinear con flujo “cuenta lista”
    -- (correo técnico @mega-varonil.local deja must_complete_email=true).
    update public.profiles
    set
      must_complete_email = false,
      full_name = r.full_name,
      phone = r.phone_digits,
      role = 'player',
      category_id = v_cat,
      status = 'active'
    where id = v_uid;

    raise notice 'Creado «%» id=% email técnico=%', r.full_name, v_uid, v_email;
  end loop;
end
$$;
