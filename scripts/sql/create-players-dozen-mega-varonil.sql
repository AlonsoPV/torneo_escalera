-- =============================================================================
-- Crear 12 jugadores con rol «player» (Auth + perfil vía trigger handle_new_user).
-- Nombres según lista de importación / planilla.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor (rol postgres).
--
-- Requisitos:
--   - Extensión pgcrypto (bcrypt).
--   - Al menos una fila en public.player_categories (usa la primera por nombre).
--
-- Ajustar antes de ejecutar:
--   - v_pass_plain — contraseña temporal (≥ 6 caracteres).
--   - Celulares únicos — columna «phone»: deben ser distintos y no repetir otros
--     jugadores ya en public.profiles.
--
-- Correo técnico por jugador: {phone}@mega-varonil.local (flujo habitual en la app).
--
-- ID de usuario/perfil (`auth.users.id` = `public.profiles.id`):
--   UUID fijos en la primera columna de VALUES para copiarlos a planillas u otros INSERT.
-- `external_id` en perfil: mismo teléfono (referencia estable en importaciones / admin).
--
-- Idempotencia: omite si ya existe auth.users con ese email o perfil con ese teléfono
--   o UUID ya usado por otro usuario.
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
        -- (id fijo UUID, celular único, nombre). Cambia IDs solo si sabes que no chocarán en auth/profiles.
        ('e7c3b4a2-0101-4e01-8111-551990002001'::uuid, '551990002001'::text, 'Jerome Aymeric'::text),
        ('e7c3b4a2-0102-4e02-8111-551990002002'::uuid, '551990002002'::text, 'Francisco Pinilla'::text),
        ('e7c3b4a2-0103-4e03-8111-551990002003'::uuid, '551990002003'::text, 'Sergio Marquez'::text),
        ('e7c3b4a2-0104-4e04-8111-551990002004'::uuid, '551990002004'::text, 'Louis Steenbrink'::text),
        ('e7c3b4a2-0105-4e05-8111-551990002005'::uuid, '551990002005'::text, 'Miguel Huber'::text),
        ('e7c3b4a2-0106-4e06-8111-551990002006'::uuid, '551990002006'::text, 'Nico Gavaldon'::text),
        ('e7c3b4a2-0107-4e07-8111-551990002007'::uuid, '551990002007'::text, 'Frank'::text),
        ('e7c3b4a2-0108-4e08-8111-551990002008'::uuid, '551990002008'::text, 'Jules Cicurel'::text),
        ('e7c3b4a2-0109-4e09-8111-551990002009'::uuid, '551990002009'::text, 'Rafa Orozco'::text),
        ('e7c3b4a2-0110-4e0a-8111-551990002010'::uuid, '551990002010'::text, 'Alejandro Escandon'::text),
        ('e7c3b4a2-0111-4e0b-8111-551990002011'::uuid, '551990002011'::text, 'Fernando Magdaleno'::text),
        ('e7c3b4a2-0112-4e0c-8111-551990002012'::uuid, '551990002012'::text, 'Juan Pablo Preisser'::text)
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

    raise notice 'Creado «%» profiles.id/auth.users.id=% external_id=% email=%', r.full_name, v_uid, r.phone_digits, v_email;
  end loop;
end
$$;
