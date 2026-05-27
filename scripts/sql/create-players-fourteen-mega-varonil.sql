-- =============================================================================
-- Crear 14 jugadores con rol «player» (Auth + perfil vía trigger handle_new_user).
-- Lista y orden según planilla; nombres 13–14 en mayúsculas tal como en el origen.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor (rol postgres).
--
-- Requisitos:
--   - Extensión pgcrypto (bcrypt).
--   - Al menos una fila en public.player_categories (usa la primera por nombre).
--
-- Ajustar antes de ejecutar:
--   - v_pass_plain — contraseña temporal (≥ 6 caracteres).
--   - Si ya usaste los teléfonos 551990003001…014 u otros UUID, cámbialos en VALUES.
--
-- ID: `auth.users.id` = `public.profiles.id` (UUID fijos, columna 1 de VALUES).
-- external_id = mismo teléfono (referencia en admin / importaciones).
-- Email técnico: {phone}@mega-varonil.local
--
-- Idempotencia: omite si existe auth.users con ese id, ese email, o perfil con ese phone.
-- =============================================================================

create extension if not exists pgcrypto;

do $$
declare
  v_cat uuid;
  v_now timestamptz := now();
  v_instance uuid := '00000000-0000-0000-0000-000000000000';
  v_pass_plain text := 'Cambiar123!';
  v_pw text := crypt(v_pass_plain, gen_salt('bf'));

  r record;
  v_uid uuid;
  v_email text;
  v_meta jsonb;
begin
  select id into v_cat
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
        ('e7c3b4a2-0301-4e01-8111-551990003001'::uuid, '551990003001'::text, 'Fernando Magdaleno'::text),
        ('e7c3b4a2-0302-4e02-8111-551990003002'::uuid, '551990003002'::text, 'Rafa Orozco'::text),
        ('e7c3b4a2-0303-4e03-8111-551990003003'::uuid, '551990003003'::text, 'Alejandro Escandon'::text),
        ('e7c3b4a2-0304-4e04-8111-551990003004'::uuid, '551990003004'::text, 'Juan Pablo Preisser'::text),
        ('e7c3b4a2-0305-4e05-8111-551990003005'::uuid, '551990003005'::text, 'Jerome Aymeric'::text),
        ('e7c3b4a2-0306-4e06-8111-551990003006'::uuid, '551990003006'::text, 'Francisco Pinilla'::text),
        ('e7c3b4a2-0307-4e07-8111-551990003007'::uuid, '551990003007'::text, 'Sergio Marquez'::text),
        ('e7c3b4a2-0308-4e08-8111-551990003008'::uuid, '551990003008'::text, 'Louis Steenbrink'::text),
        ('e7c3b4a2-0309-4e09-8111-551990003009'::uuid, '551990003009'::text, 'Miguel Huber'::text),
        ('e7c3b4a2-030a-4e0a-8111-551990003010'::uuid, '551990003010'::text, 'Nico Gavaldon'::text),
        ('e7c3b4a2-030b-4e0b-8111-551990003011'::uuid, '551990003011'::text, 'Frank'::text),
        ('e7c3b4a2-030c-4e0c-8111-551990003012'::uuid, '551990003012'::text, 'Jules Cicurel'::text),
        ('e7c3b4a2-030d-4e0d-8111-551990003013'::uuid, '551990003013'::text, 'RICARDO CORTÉZ'::text),
        ('e7c3b4a2-030e-4e0e-8111-551990003014'::uuid, '551990003014'::text, 'ANDRÉS GÓMEZ'::text)
    ) as t(player_id, phone_digits, full_name)
  loop
    v_uid := r.player_id;
    v_email := r.phone_digits || '@mega-varonil.local';

    if exists (select 1 from auth.users u where u.id = v_uid) then
      raise notice 'Omitiendo «%»: ya existe auth.users id=%', r.full_name, v_uid;
      continue;
    end if;

    if exists (select 1 from public.profiles p where p.phone = r.phone_digits) then
      raise notice 'Omitiendo «%»: ya existe perfil con phone=%', r.full_name, r.phone_digits;
      continue;
    end if;

    if exists (select 1 from auth.users u where u.email = v_email) then
      raise notice 'Omitiendo «%»: ya existe auth.users con email=%', r.full_name, v_email;
      continue;
    end if;

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

    update public.profiles
    set
      must_complete_email = false,
      full_name = r.full_name,
      phone = r.phone_digits,
      external_id = r.phone_digits,
      role = 'player',
      category_id = v_cat,
      status = 'active'
    where id = v_uid;

    raise notice 'Creado «%» id=% tel=% email=%', r.full_name, v_uid, r.phone_digits, v_email;
  end loop;
end
$$;
