// @ts-nocheck — Supabase Edge / Deno sin Database genérico.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

function err(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function technicalAuthEmailFromDigits(digits: string): string {
  return `${digits}@mega-varonil.local`
}

async function digestSeedPhone(seed: string, salt: number): Promise<string> {
  const payload = `${seed}::${salt}`
  const buf = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)))
  const dv = new DataView(buf.buffer)
  const n = dv.getUint32(0, false) % 100_000_000
  return `90${String(n).padStart(8, '0')}`
}

function randomDigits8(): string {
  return String(10_000_000 + Math.floor(Math.random() * 89_999_999))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'POST') return err('Método no permitido', 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return err('No autorizado', 401)
  }

  let body: {
    fullName?: string
    externalId?: string | null
    groupId?: string
    tournamentId?: string
  }
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido', 400)
  }

  const fullName = String(body.fullName ?? '').trim()
  const externalIdRaw = body.externalId != null ? String(body.externalId).trim() : ''
  const externalId = externalIdRaw || null
  const groupId = String(body.groupId ?? '').trim()
  const tournamentId = String(body.tournamentId ?? '').trim()

  if (!fullName) return err('El nombre es obligatorio para crear el jugador', 400)
  if (!groupId || !tournamentId) return err('groupId y tournamentId son obligatorios', 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return err('No autorizado', 401)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: actor, error: actorErr } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single()

  if (actorErr || !actor) return err('Sin permisos', 403)
  const actorRole = (actor as { role: string }).role
  if (!['admin', 'super_admin'].includes(actorRole)) {
    return err('Sin permisos', 403)
  }

  if (externalId) {
    const { data: byExt } = await admin.from('profiles').select('*').eq('external_id', externalId).maybeSingle()
    if (byExt) {
      return ok({ profile: byExt, created: false })
    }
  }

  const { data: gRow, error: gErr } = await admin
    .from('groups')
    .select('id, tournament_id, group_category_id')
    .eq('id', groupId)
    .single()

  if (gErr || !gRow) return err('Grupo no encontrado', 400)
  if ((gRow as { tournament_id: string }).tournament_id !== tournamentId) {
    return err('El grupo no pertenece al torneo indicado', 400)
  }

  let categoryId: string | null = null
  const gcId = (gRow as { group_category_id: string | null }).group_category_id
  if (gcId) {
    const { data: gc } = await admin.from('group_categories').select('name').eq('id', gcId).maybeSingle()
    const gcName = ((gc as { name?: string } | null)?.name ?? '').trim()
    if (gcName) {
      const { data: pc } = await admin.from('player_categories').select('id, name').eq('name', gcName).maybeSingle()
      if (pc) {
        categoryId = (pc as { id: string }).id
      } else {
        const { data: insPc, error: insPcErr } = await admin
          .from('player_categories')
          .insert({
            name: gcName,
            description: 'Creada automáticamente al importar resultados',
            created_by: userData.user.id,
          })
          .select('id')
          .single()
        if (!insPcErr && insPc) {
          categoryId = (insPc as { id: string }).id
        } else if (insPcErr?.code === '23505') {
          const { data: ex } = await admin.from('player_categories').select('id').eq('name', gcName).maybeSingle()
          if (ex) categoryId = (ex as { id: string }).id
        }
      }
    }
  }

  const seed = `${tournamentId}|${groupId}|${externalId ?? ''}|${fullName}`
  let digits: string | null = null
  for (let i = 0; i < 80; i++) {
    const candidate = await digestSeedPhone(seed, i)
    const { data: taken } = await admin.from('profiles').select('id').eq('phone', candidate).maybeSingle()
    if (!taken) {
      digits = candidate
      break
    }
  }
  if (!digits) return err('No se pudo asignar un teléfono técnico único', 500)

  const password = randomDigits8()
  const technicalEmail = technicalAuthEmailFromDigits(digits)

  const meta: Record<string, string> = {
    full_name: fullName,
    phone: digits,
    role: 'player',
    bulk_import: 'true',
    provisioned_by: 'match-results-import',
  }
  if (categoryId) meta.category_id = categoryId
  if (externalId) meta.external_id = externalId

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: technicalEmail,
    password,
    email_confirm: true,
    user_metadata: meta,
  })

  if (authErr || !created.user) {
    return err(authErr?.message ?? 'No se pudo crear el usuario', 400)
  }

  const uid = created.user.id

  const patch: Record<string, unknown> = {
    full_name: fullName,
    email: null,
    role: 'player',
    category_id: categoryId,
    phone: digits,
    external_id: externalId,
    status: 'active',
    must_complete_email: true,
    email_verified: false,
    auto_enroll_eligible: false,
  }

  const { error: upErr } = await admin.from('profiles').update(patch).eq('id', uid)
  if (upErr) {
    await admin.auth.admin.deleteUser(uid)
    return err(upErr.message, 500)
  }

  const { data: profile, error: pfErr } = await admin.from('profiles').select('*').eq('id', uid).single()
  if (pfErr || !profile) {
    await admin.auth.admin.deleteUser(uid)
    return err(pfErr?.message ?? 'Perfil no encontrado tras crear usuario', 500)
  }

  return ok({ profile, created: true })
})
