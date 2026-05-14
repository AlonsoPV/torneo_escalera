// @ts-nocheck — mismo caso que otras Edge Functions: cliente sin Database genérico.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

type NormalizePhoneResult =
  | { ok: true; digits: string }
  | { ok: false; error: string }

function normalizePhone(raw: string): NormalizePhoneResult {
  let s = String(raw ?? '').trim()
  s = s.replace(/[\s\-().]/g, '')
  if (s.startsWith('+52')) {
    s = s.slice(3)
  }
  let digits = s.replace(/\D/g, '')
  while (digits.startsWith('52') && digits.length > 10) {
    digits = digits.slice(2)
  }
  if (digits.length < 10) {
    return { ok: false, error: 'El número debe tener al menos 10 dígitos.' }
  }
  if (digits.length > 13) {
    return { ok: false, error: 'El número no puede tener más de 13 dígitos.' }
  }
  return { ok: true, digits }
}

function technicalAuthEmailFromDigits(digits: string): string {
  return `${digits}@mega-varonil.local`
}

const ALLOWED = new Set(['player', 'admin', 'super_admin'])

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

async function ensureGroupMembership(
  adminClient: ReturnType<typeof createClient>,
  args: {
    uid: string
    name: string
    targetGroupId: string | null
    tournamentId: string | null
  },
): Promise<string | null> {
  const { uid, name, targetGroupId, tournamentId } = args
  if (!targetGroupId || !tournamentId) return null

  const { data: tGroups } = await adminClient.from('groups').select('id').eq('tournament_id', tournamentId)
  const tgIds = (tGroups ?? []).map((x) => (x as { id: string }).id)
  if (!tgIds.length) return 'El torneo no tiene grupos'

  const { data: existingGp } = await adminClient
    .from('group_players')
    .select('id, group_id')
    .eq('user_id', uid)
    .in('group_id', tgIds)
    .maybeSingle()

  if (existingGp) {
    const gid = (existingGp as { group_id: string }).group_id
    if (gid === targetGroupId) return null
    return 'El jugador ya está inscrito en otro grupo de este torneo'
  }

  const { count } = await adminClient
    .from('group_players')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', targetGroupId)

  const { data: gRow } = await adminClient.from('groups').select('max_players').eq('id', targetGroupId).single()
  const cap = (gRow as { max_players: number | null } | null)?.max_players ?? 5
  if ((count ?? 0) >= cap) return `El grupo está lleno (${cap})`

  const { error: gpInsErr } = await adminClient.from('group_players').insert({
    group_id: targetGroupId,
    user_id: uid,
    display_name: name,
    seed_order: count ?? 0,
  })
  if (gpInsErr) return gpInsErr.message
  return null
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
    phone?: string
    temporaryPassword?: string
    role?: string
    categoryId?: string | null
    groupId?: string | null
    tournamentId?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido', 400)
  }

  const fullName = String(body.fullName ?? '').trim()
  const password = String(body.temporaryPassword ?? '').trim()
  let role = String(body.role ?? 'player').trim().toLowerCase()
  if (!ALLOWED.has(role)) role = 'player'

  const parsedPhone = normalizePhone(String(body.phone ?? ''))
  if (!parsedPhone.ok) {
    return err(parsedPhone.error, 400)
  }
  if (!fullName) return err('El nombre es obligatorio', 400)
  if (password.length < 6) return err('La contraseña temporal debe tener al menos 6 caracteres', 400)

  const categoryId = body.categoryId?.trim() || null
  if (!categoryId) return err('La categoría es obligatoria', 400)

  const groupId = body.groupId?.trim() || null
  const tournamentId = body.tournamentId?.trim() || null

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
  if (!['admin', 'super_admin'].includes(actorRole)) return err('Sin permisos', 403)
  if (role === 'super_admin' && actorRole !== 'super_admin') {
    return err('Solo un super admin puede crear cuentas super_admin', 403)
  }

  const { data: dup } = await admin.from('profiles').select('id').eq('phone', parsedPhone.digits).maybeSingle()
  if (dup) return err('Ya existe un usuario con ese número de celular', 409)

  const technicalEmail = technicalAuthEmailFromDigits(parsedPhone.digits)

  const { data: catOk } = await admin.from('player_categories').select('id').eq('id', categoryId).maybeSingle()
  if (!catOk) return err('Categoría no válida', 400)

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: technicalEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone: parsedPhone.digits,
      role,
      category_id: categoryId,
      provisioned_by: 'admin-create-user',
    },
  })

  if (authErr || !created.user) {
    return err(authErr?.message ?? 'No se pudo crear el usuario', 400)
  }

  const uid = created.user.id

  const patch: Record<string, unknown> = {
    full_name: fullName,
    role,
    category_id: categoryId,
    phone: parsedPhone.digits,
    email: null,
    must_complete_email: true,
    email_verified: false,
    status: 'active',
  }

  const { error: upErr } = await admin.from('profiles').update(patch).eq('id', uid)
  if (upErr) {
    await admin.auth.admin.deleteUser(uid)
    return err(upErr.message, 500)
  }

  if (role === 'player' && groupId && tournamentId) {
    const gErr = await ensureGroupMembership(admin, {
      uid,
      name: fullName,
      targetGroupId: groupId,
      tournamentId,
    })
    if (gErr) {
      await admin.auth.admin.deleteUser(uid)
      return err(gErr, 400)
    }
  }

  return ok({ userId: uid, phone: parsedPhone.digits })
})
