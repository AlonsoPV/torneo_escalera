/**
 * Crea dos jugadores (role player) con cuenta lista para iniciar sesión:
 * - RICARDO CORTÉZ
 * - ANDRÉS GÓMEZ
 *
 * Requisitos:
 * - Variables de entorno (service role, NO exponer en cliente):
 *     SUPABASE_URL
 *     SUPABASE_SERVICE_ROLE_KEY
 *
 * Opcional:
 *     TEMP_PASSWORD     contraseña temporal (mín. 6 caracteres). Por defecto: Cambiar123!
 *     CATEGORY_ID       UUID de player_categories; si no va, se usa la primera categoría del proyecto.
 *     PHONE_RICARDO     10–13 dígitos (solo números). Por defecto 551990001001 (cámbialo si ya existe).
 *     PHONE_ANDRES      igual. Por defecto 551990001002.
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/create-players-ricardo-andres.mjs
 *
 * Uso (bash):
 *   export SUPABASE_URL=...
 *   export SUPABASE_SERVICE_ROLE_KEY=...
 *   node scripts/create-players-ricardo-andres.mjs
 */

import { createClient } from '@supabase/supabase-js'

function normalizePhone(raw) {
  let s = String(raw ?? '').trim().replace(/[\s\-().]/g, '')
  if (s.startsWith('+52')) s = s.slice(3)
  let digits = s.replace(/\D/g, '')
  while (digits.startsWith('52') && digits.length > 10) digits = digits.slice(2)
  if (digits.length < 10 || digits.length > 13) {
    throw new Error(`Teléfono inválido (${digits.length} dígitos): use 10–13 dígitos`)
  }
  return digits
}

function technicalEmail(digits) {
  return `${digits}@mega-varonil.local`
}

const PLAYERS = [
  { fullName: 'RICARDO CORTÉZ', phoneEnv: 'PHONE_RICARDO', defaultDigits: '551990001001' },
  { fullName: 'ANDRÉS GÓMEZ', phoneEnv: 'PHONE_ANDRES', defaultDigits: '551990001002' },
]

async function main() {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
    process.exit(1)
  }

  const password = (process.env.TEMP_PASSWORD ?? 'Cambiar123!').trim()
  if (password.length < 6) {
    console.error('TEMP_PASSWORD debe tener al menos 6 caracteres.')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let categoryId = process.env.CATEGORY_ID?.trim() || null
  if (!categoryId) {
    const { data: cats, error: catErr } = await admin
      .from('player_categories')
      .select('id')
      .order('name', { ascending: true })
      .limit(1)
    if (catErr) {
      console.error('No se pudieron leer categorías:', catErr.message)
      process.exit(1)
    }
    if (!cats?.length) {
      console.error('No hay categorías en player_categories. Crea una o define CATEGORY_ID.')
      process.exit(1)
    }
    categoryId = cats[0].id
    console.log('Usando categoría:', categoryId)
  }

  for (const p of PLAYERS) {
    const rawPhone = process.env[p.phoneEnv] ?? p.defaultDigits
    let digits
    try {
      digits = normalizePhone(rawPhone)
    } catch (e) {
      console.error(`${p.fullName}:`, e.message)
      process.exit(1)
    }

    const { data: dup } = await admin.from('profiles').select('id').eq('phone', digits).maybeSingle()
    if (dup) {
      console.log(`Saltando «${p.fullName}»: ya existe perfil con teléfono ${digits} (${dup.id})`)
      continue
    }

    const email = technicalEmail(digits)

    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: p.fullName,
        phone: digits,
        role: 'player',
        category_id: categoryId,
        provisioned_by: 'scripts/create-players-ricardo-andres.mjs',
      },
    })

    if (authErr || !created?.user) {
      console.error(`Auth «${p.fullName}»:`, authErr?.message ?? 'sin usuario')
      process.exit(1)
    }

    const uid = created.user.id

    const { error: upErr } = await admin
      .from('profiles')
      .update({
        full_name: p.fullName,
        role: 'player',
        category_id: categoryId,
        phone: digits,
        email: null,
        must_complete_email: false,
        email_verified: false,
        status: 'active',
      })
      .eq('id', uid)

    if (upErr) {
      console.error(`Perfil «${p.fullName}»:`, upErr.message)
      await admin.auth.admin.deleteUser(uid)
      process.exit(1)
    }

    console.log(`OK «${p.fullName}» → user_id=${uid}, tel=${digits}, login email técnico=${email}`)
  }

  console.log('\nListo. Email confirmado en Auth (pueden iniciar sesión con la contraseña temporal).')
  console.log('Correo de recuperación en perfil sigue vacío; pueden añadirlo desde admin o el propio jugador si la app lo permite.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
