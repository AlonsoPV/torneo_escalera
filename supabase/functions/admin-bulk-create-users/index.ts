// @ts-nocheck — tipado Postgrest/Supabase sin Database genérico; runtime validado por Deno en deploy.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

import { formatAuthPasswordError, isPasswordLongEnough, MIN_PASSWORD_LENGTH, passwordMinLengthError } from '../_shared/passwordPolicy.ts'

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

type RowInput = {
  rowNumber: number
  externalId: string
  phone: string
  fullName: string
  role: string
  categoryName: string
  password: string
  groupName?: string | null
  pj?: number | null
  pts?: number | null
  recoveryEmail?: string | null
  /** Preferido frente al legado pj/pts: estado de cuenta en la aplicación */
  accountStatus?: 'active' | 'inactive' | null
}

type Body = {
  tournamentId?: string | null
  fileName?: string
  createMissingCategories?: boolean
  rows: RowInput[]
}

const ALLOWED = new Set(['player', 'admin', 'super_admin'])

function err(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, error: message }), {
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

function normalizeLabel(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function validateRecoveryEmailImport(raw: unknown): { ok: true; value: string | null } | { ok: false; msg: string } {
  const s = String(raw ?? '').trim()
  if (!s) return { ok: true, value: null }
  if (s.toLowerCase().endsWith('@mega-varonil.local')) {
    return { ok: false, msg: 'Correo de recuperación no puede usar el dominio técnico @mega-varonil.local.' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    return { ok: false, msg: 'Correo de recuperación inválido.' }
  }
  return { ok: true, value: s }
}

/** Vacío → activo (default). */
function parseAccountRowStatus(raw: unknown): { ok: true; status: 'active' | 'inactive' } | { ok: false; msg: string } {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!s || s === 'activo' || s === 'active') return { ok: true, status: 'active' }
  if (s === 'inactivo' || s === 'inactive') return { ok: true, status: 'inactive' }
  return { ok: false, msg: 'Cuenta: usa "activo" o "inactivo" (vacío = activo).' }
}

function isValidBulkImportPassword(p: string): boolean {
  return isPasswordLongEnough(p)
}

function normalizePasswordImportValue(raw: unknown): string {
  const s = String(raw ?? '').trim()
  const n = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!s || s === '—' || s === '-') return ''
  if (n === 'no disponible' || n === 'sin cambio' || n === '(sin cambio)') return ''
  return s
}

function parseCarryStatInput(
  label: string,
  v: unknown,
  mode: 'nonNegative' | 'signed',
): { ok: true; n: number | null } | { ok: false; msg: string } {
  if (v === null || v === undefined) return { ok: true, n: null }
  if (typeof v === 'number') {
    if (!Number.isInteger(v)) return { ok: false, msg: `${label}: entero o vacío` }
    if (mode === 'nonNegative' && v < 0) return { ok: false, msg: `${label}: entero ≥ 0 o vacío` }
    return { ok: true, n: v }
  }
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return { ok: true, n: null }
    const okText = mode === 'nonNegative' ? /^\d+$/.test(s) : /^[+-]?\d+$/.test(s)
    if (!okText) {
      const hint = mode === 'nonNegative' ? 'entero ≥ 0' : 'entero (puede ser negativo)'
      return { ok: false, msg: `${label}: ${hint} o vacío` }
    }
    const x = Number(s)
    if (!Number.isSafeInteger(x)) return { ok: false, msg: `${label}: valor demasiado grande` }
    if (mode === 'nonNegative' && x < 0) return { ok: false, msg: `${label}: entero ≥ 0 o vacío` }
    return { ok: true, n: x }
  }
  return { ok: false, msg: `${label} inválido` }
}

type ResultRow = {
  rowNumber: number
  externalId: string
  phone: string
  fullName: string
  email: string
  temporaryPassword: string
  categoryName: string
  status: 'success' | 'error'
  error?: string
  userId?: string
  operation?: 'created' | 'updated'
}

type BulkImportAuditInsert = {
  batch_id: string
  row_number: number
  external_id: string | null
  full_name: string | null
  role: string
  group_name: string | null
  category_name: string
  status: 'success' | 'error'
  error_message: string | null
  created_profile_id: string | null
}

async function insertBulkRow(
  adminClient: ReturnType<typeof createClient>,
  args: {
    batchId: string
    rowNumber: number
    externalId: string | null
    fullName: string | null
    role: string
    groupName: string | null
    categoryName: string
    status: 'success' | 'error'
    errorMessage: string | null
    createdProfileId?: string | null
  },
) {
  const externalId = args.externalId ?? args.external_id ?? null
  const fullName = args.fullName ?? args.full_name ?? null
  const auditRow: BulkImportAuditInsert = {
    batch_id: args.batchId,
    row_number: args.rowNumber,
    external_id: externalId,
    full_name: fullName,
    role: args.role,
    group_name: args.groupName ?? null,
    category_name: args.categoryName,
    status: args.status,
    error_message: args.errorMessage,
    created_profile_id: args.createdProfileId ?? null,
  }
  const queued = (adminClient as unknown as { __bulkImportAuditRows?: BulkImportAuditInsert[] }).__bulkImportAuditRows
  if (queued) {
    queued.push(auditRow)
    return
  }
  await adminClient.from('bulk_import_rows').insert(auditRow)
}

async function upsertVisiblePassword(
  adminClient: ReturnType<typeof createClient>,
  args: { userId: string; password: string; actorId: string },
): Promise<string | null> {
  const password = String(args.password ?? '').trim()
  if (!password || password === '—') return null
  const { error } = await adminClient.from('admin_user_credentials').upsert({
    user_id: args.userId,
    password_plain: password,
    updated_by: args.actorId,
    updated_at: new Date().toISOString(),
  })
  return error?.message ?? null
}

/** Asigna grupo si aplica; devuelve mensaje de error o null si OK. */
async function ensureGroupMembership(
  adminClient: ReturnType<typeof createClient>,
  args: {
    uid: string
    name: string
    targetGroupId: string | null
    tournamentId: string | null
    liveGroupCount: Map<string, number>
    affectedGroupIds: Set<string>
    tournamentGroupIds?: string[]
    existingMembershipByUser?: Map<string, { id: string; group_id: string; user_id: string }>
    matchCountByGroupPlayer?: Map<string, number>
  },
): Promise<string | null> {
  const { uid, name, targetGroupId, tournamentId, liveGroupCount, affectedGroupIds } = args
  if (!targetGroupId || !tournamentId) return null

  let tgIds = args.tournamentGroupIds ?? []
  if (!args.tournamentGroupIds) {
    const { data: tGroups } = await adminClient.from('groups').select('id').eq('tournament_id', tournamentId)
    tgIds = (tGroups ?? []).map((x) => (x as { id: string }).id)
  }
  if (!tgIds.length) return 'El torneo no tiene grupos'

  let existingGp: { id: string; group_id: string; user_id: string } | null =
    args.existingMembershipByUser?.get(uid) ?? null
  if (!args.existingMembershipByUser) {
    const { data } = await adminClient
      .from('group_players')
      .select('id, group_id, user_id')
      .eq('user_id', uid)
      .in('group_id', tgIds)
      .maybeSingle()
    existingGp = (data as { id: string; group_id: string; user_id: string } | null) ?? null
  }

  if (existingGp) {
    const current = existingGp as { id: string; group_id: string; user_id: string }
    if (current.group_id === targetGroupId) {
      const { error: nameErr } = await adminClient
        .from('group_players')
        .update({ display_name: name })
        .eq('id', current.id)
      return nameErr?.message ?? null
    }
    let matchCount = args.matchCountByGroupPlayer?.get(current.id) ?? null
    if (matchCount === null) {
      const { count, error: matchCountErr } = await adminClient
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .or(`player_a_id.eq.${current.id},player_b_id.eq.${current.id}`)
      if (matchCountErr) return matchCountErr.message
      matchCount = count ?? 0
    }
    if ((matchCount ?? 0) > 0) {
      return 'El jugador ya tiene partidos en otro grupo de este torneo; no se puede mover por importacion.'
    }

    const ord = liveGroupCount.get(targetGroupId) ?? 0
    const { error: moveErr } = await adminClient
      .from('group_players')
      .update({
        group_id: targetGroupId,
        display_name: name,
        seed_order: ord,
      })
      .eq('id', current.id)
    if (moveErr) return moveErr.message
    liveGroupCount.set(targetGroupId, ord + 1)
    liveGroupCount.set(current.group_id, Math.max(0, (liveGroupCount.get(current.group_id) ?? 1) - 1))
    args.existingMembershipByUser?.set(uid, { ...current, group_id: targetGroupId })
    affectedGroupIds.add(targetGroupId)
    affectedGroupIds.add(current.group_id)
    return null
  }

  const ord = liveGroupCount.get(targetGroupId) ?? 0
  const { data: insertedGp, error: gpInsErr } = await adminClient
    .from('group_players')
    .insert({
      group_id: targetGroupId,
      user_id: uid,
      display_name: name,
      seed_order: ord,
    })
    .select('id, group_id, user_id')
    .single()
  if (gpInsErr) return gpInsErr.message
  if (insertedGp) {
    args.existingMembershipByUser?.set(uid, insertedGp as { id: string; group_id: string; user_id: string })
  }
  liveGroupCount.set(targetGroupId, ord + 1)
  affectedGroupIds.add(targetGroupId)
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return err('Método no permitido', 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return err('No autorizado. Envía Authorization: Bearer <access_token>.', 401)
    }

    let body: Body
    try {
      body = (await req.json()) as Body
    } catch {
      return err('Cuerpo JSON inválido', 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) return err('No autorizado', 401)

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', userData.user.id)
      .single()

    if (profileErr || !profile) return err('No tienes permisos para importar usuarios.', 403)
    if (!['admin', 'super_admin'].includes(profile.role as string)) {
      return err('No tienes permisos para importar usuarios.', 403)
    }

    const callerIsSuper = profile.role === 'super_admin'

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return err('rows requeridos', 400)
    }
    if (body.rows.length > 200) return err('Máximo 200 filas por lote', 400)

    const tournamentId =
      body.tournamentId && String(body.tournamentId).trim() ? String(body.tournamentId).trim() : null
    if (tournamentId) {
      const { data: tRow, error: tErr } = await adminClient.from('tournaments').select('id').eq('id', tournamentId).single()
      if (tErr || !tRow) return err('Torneo no encontrado', 400)
    }

    const createCat = body.createMissingCategories !== false

    const { data: batchIns, error: batchErr } = await adminClient
      .from('bulk_import_batches')
      .insert({
        tournament_id: tournamentId,
        uploaded_by: userData.user.id,
        total_rows: body.rows.length,
        status: 'processing',
        file_name: body.fileName ?? null,
        success_rows: 0,
        error_rows: 0,
      })
      .select('id')
      .single()

    if (batchErr || !batchIns) return err(batchErr?.message ?? 'No se creó el lote', 500)

    const batchId = batchIns.id as string

    const results: ResultRow[] = []
    let success = 0
    let errors = 0
    const auditRows: BulkImportAuditInsert[] = []
    const auditClient = adminClient as unknown as { __bulkImportAuditRows?: BulkImportAuditInsert[] }
    auditClient.__bulkImportAuditRows = auditRows

    const { data: catRows } = await adminClient.from('player_categories').select('id, name')
    const categoryByNorm = new Map<string, string>()
    for (const c of catRows ?? []) {
      const crow = c as { id: string; name: string }
      categoryByNorm.set(crow.name.trim().toLowerCase(), crow.id)
    }

    type GroupInfo = { id: string; max_players: number | null }
    type ProfileLookup = { id: string; external_id: string | null; phone: string | null }
    const groupByNorm = new Map<string, GroupInfo>()
    const liveGroupCount = new Map<string, number>()
    const groupPlayerByUser = new Map<string, { id: string; group_id: string; user_id: string }>()
    const matchCountByGroupPlayer = new Map<string, number>()
    const affectedGroupIds = new Set<string>()
    let tournamentGroupIds: string[] = []
    if (tournamentId) {
      const { data: groupRows } = await adminClient
        .from('groups')
        .select('id, name, max_players')
        .eq('tournament_id', tournamentId)
      for (const g of groupRows ?? []) {
        const gr = g as { id: string; name: string; max_players: number | null }
        groupByNorm.set(normalizeLabel(gr.name).toLowerCase(), { id: gr.id, max_players: gr.max_players })
      }
      const gids = [...new Set([...groupByNorm.values()].map((x) => x.id))]
      tournamentGroupIds = gids
      for (const gid of gids) liveGroupCount.set(gid, 0)
      if (gids.length) {
        const { data: gp } = await adminClient.from('group_players').select('id, group_id, user_id').in('group_id', gids)
        const gpIds: string[] = []
        for (const r of gp ?? []) {
          const row = r as { id: string; group_id: string; user_id: string }
          const gid = row.group_id
          liveGroupCount.set(gid, (liveGroupCount.get(gid) ?? 0) + 1)
          groupPlayerByUser.set(row.user_id, row)
          gpIds.push(row.id)
        }
        if (gpIds.length) {
          const { data: matchesForPlayers } = await adminClient
            .from('matches')
            .select('player_a_id, player_b_id')
            .in('group_id', gids)
          for (const m of matchesForPlayers ?? []) {
            const row = m as { player_a_id: string; player_b_id: string }
            matchCountByGroupPlayer.set(row.player_a_id, (matchCountByGroupPlayer.get(row.player_a_id) ?? 0) + 1)
            matchCountByGroupPlayer.set(row.player_b_id, (matchCountByGroupPlayer.get(row.player_b_id) ?? 0) + 1)
          }
        }
      }
    }

    const extLookup = [...new Set(body.rows.map((r) => String(r.externalId ?? '').trim()).filter(Boolean))]
    const phoneLookup = [
      ...new Set(
        body.rows
          .map((r) => normalizePhone(String(r.phone ?? '')))
          .filter((r): r is { ok: true; digits: string } => r.ok)
          .map((r) => r.digits),
      ),
    ]
    const profileByExt = new Map<string, ProfileLookup>()
    const profileByPhone = new Map<string, ProfileLookup>()
    if (extLookup.length) {
      const { data: profsByExt } = await adminClient
        .from('profiles')
        .select('id, external_id, phone')
        .in('external_id', extLookup)
      for (const p of profsByExt ?? []) {
        const row = p as ProfileLookup
        if (row.external_id) profileByExt.set(row.external_id, row)
      }
    }
    if (phoneLookup.length) {
      const { data: profsByPhone } = await adminClient
        .from('profiles')
        .select('id, external_id, phone')
        .in('phone', phoneLookup)
      for (const p of profsByPhone ?? []) {
        const row = p as ProfileLookup
        if (row.phone) profileByPhone.set(row.phone, row)
      }
    }

    for (const row of body.rows) {
      const rowGroupAudit = normalizeLabel(row.groupName ?? '') || null
      const ext = row.externalId?.trim() ?? ''
      const name = row.fullName?.trim() ?? ''
      const roleRaw = (row.role ?? '').trim().toLowerCase()
      const cnameRaw = normalizeLabel(row.categoryName ?? '')
      const cname = cnameRaw.replace(/\s+/g, '').length === 0 ? '' : cnameRaw
      const phoneParsed = normalizePhone(String(row.phone ?? ''))

      const recoveryCheck = validateRecoveryEmailImport(row.recoveryEmail ?? '')
      const accountParsed =
        row.accountStatus === 'active' || row.accountStatus === 'inactive'
          ? ({ ok: true as const, status: row.accountStatus } as const)
          : parseAccountRowStatus('')

      const baseResult = (phoneDigits: string, temp: string): Omit<ResultRow, 'status' | 'error' | 'userId'> => ({
        rowNumber: row.rowNumber,
        externalId: ext,
        phone: phoneDigits,
        fullName: name,
        email: '',
        temporaryPassword: temp,
        categoryName: cname,
      })

      if (!recoveryCheck.ok) {
        errors += 1
        results.push({
          ...baseResult('', ''),
          status: 'error',
          error: recoveryCheck.msg,
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name || null,
          role: roleRaw || 'player',
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: recoveryCheck.msg,
        })
        continue
      }

      if (!accountParsed.ok) {
        errors += 1
        results.push({
          ...baseResult('', ''),
          status: 'error',
          error: accountParsed.msg,
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name || null,
          role: roleRaw || 'player',
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: accountParsed.msg,
        })
        continue
      }
      const rowAccountStatus = accountParsed.status

      if (!roleRaw) {
        errors += 1
        results.push({
          ...baseResult('', ''),
          status: 'error',
          error: 'Rol obligatorio',
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name || null,
          role: 'player',
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: 'Rol obligatorio',
        })
        continue
      }

      const role = roleRaw
      if (!ALLOWED.has(role)) {
        errors += 1
        results.push({
          ...baseResult('', ''),
          status: 'error',
          error: 'Rol no válido: usa player, admin o super_admin',
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name || null,
          role,
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: 'Rol no válido',
        })
        continue
      }

      if (role === 'super_admin' && !callerIsSuper) {
        errors += 1
        results.push({
          ...baseResult('', ''),
          status: 'error',
          error: 'Solo un super admin puede asignar el rol super_admin',
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name || null,
          role,
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: 'Solo un super admin puede asignar el rol super_admin',
        })
        continue
      }

      if (!name) {
        errors += 1
        results.push({
          ...baseResult('', ''),
          status: 'error',
          error: 'Nombre obligatorio',
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name || null,
          role,
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: 'Nombre obligatorio',
        })
        continue
      }

      if (!phoneParsed.ok) {
        errors += 1
        results.push({
          ...baseResult('', ''),
          status: 'error',
          error: phoneParsed.error,
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name || null,
          role,
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: phoneParsed.error,
        })
        continue
      }

      const digits = phoneParsed.digits

      const pjIn = parseCarryStatInput('PJ', row.pj, 'nonNegative')
      if (!pjIn.ok) {
        errors += 1
        results.push({
          ...baseResult(digits, ''),
          status: 'error',
          error: pjIn.msg,
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name,
          role,
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: pjIn.msg,
        })
        continue
      }
      const ptsIn = parseCarryStatInput('Pts', row.pts, 'signed')
      if (!ptsIn.ok) {
        errors += 1
        results.push({
          ...baseResult(digits, ''),
          status: 'error',
          error: ptsIn.msg,
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name,
          role,
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: ptsIn.msg,
        })
        continue
      }
      const pjVal = pjIn.n
      const ptsVal = ptsIn.n

      const byExt = ext ? profileByExt.get(ext) ?? null : null
      const byPhone = profileByPhone.get(digits) ?? null

      const extId = byExt ? (byExt as { id: string }).id : null
      const phoneId = byPhone ? (byPhone as { id: string }).id : null

      if (ext && extId && phoneId && extId !== phoneId) {
        errors += 1
        results.push({
          ...baseResult(digits, ''),
          status: 'error',
          error: 'El ID externo y el celular corresponden a usuarios distintos',
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name,
          role,
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: 'Conflicto ID / celular',
        })
        continue
      }

      const existingProf = extId ? byExt : phoneId ? byPhone : null

      const passwordRaw = normalizePasswordImportValue(row.password)
      if (!existingProf) {
        if (!ext) {
          errors += 1
          results.push({
            ...baseResult(digits, ''),
            status: 'error',
            error: 'ID obligatorio para altas nuevas',
          })
          await insertBulkRow(adminClient, {
            batchId,
            rowNumber: row.rowNumber,
            external_id: null,
            full_name: name,
            role,
            groupName: rowGroupAudit,
            categoryName: cname,
            status: 'error',
            errorMessage: 'ID obligatorio para altas nuevas',
          })
          continue
        }
        if (!isValidBulkImportPassword(passwordRaw)) {
          errors += 1
          results.push({
            ...baseResult(digits, ''),
            status: 'error',
            error: passwordMinLengthError('Contraseña inválida'),
          })
          await insertBulkRow(adminClient, {
            batchId,
            rowNumber: row.rowNumber,
            external_id: ext || null,
            full_name: name,
            role,
            groupName: rowGroupAudit,
            categoryName: cname,
            status: 'error',
            errorMessage: 'Contraseña inválida',
          })
          continue
        }
      } else {
        if (passwordRaw !== '' && !isValidBulkImportPassword(passwordRaw)) {
          errors += 1
          results.push({
            ...baseResult(digits, ''),
            status: 'error',
            error: `Contraseña: mínimo ${MIN_PASSWORD_LENGTH} caracteres o déjala vacía para no cambiar la actual`,
          })
          await insertBulkRow(adminClient, {
            batchId,
            rowNumber: row.rowNumber,
            external_id: ext || null,
            full_name: name,
            role,
            groupName: rowGroupAudit,
            categoryName: cname,
            status: 'error',
            errorMessage: 'Contraseña inválida (actualización)',
          })
          continue
        }
      }

      let categoryId: string | null = null
      if (cname) {
        categoryId = categoryByNorm.get(cname.toLowerCase()) ?? null
        if (!categoryId && createCat) {
          const { data: insCat, error: catErr } = await adminClient
            .from('player_categories')
            .insert({
              name: cname,
              description: null,
              created_by: userData.user.id,
            })
            .select('id')
            .single()
          if (!catErr && insCat) {
            categoryId = (insCat as { id: string }).id
            categoryByNorm.set(cname.toLowerCase(), categoryId)
          } else if (catErr?.code === '23505') {
            const { data: exCat } = await adminClient
              .from('player_categories')
              .select('id, name')
              .eq('name', cname)
              .maybeSingle()
            if (exCat) {
              categoryId = (exCat as { id: string }).id
              categoryByNorm.set(cname.toLowerCase(), categoryId)
            }
          }
        }
        if (!categoryId) {
          errors += 1
          results.push({
            ...baseResult(digits, ''),
            status: 'error',
            error: `Categoría "${cname}" no existe`,
          })
          await insertBulkRow(adminClient, {
            batchId,
            rowNumber: row.rowNumber,
            external_id: ext || null,
            full_name: name,
            role,
            groupName: rowGroupAudit,
            categoryName: cname,
            status: 'error',
            errorMessage: 'Categoría inexistente',
          })
          continue
        }
      }

      let targetGroupId: string | null = null
      const gname = rowGroupAudit ?? ''
      const wantsGroup = gname.length > 0 && role === 'player'
      if (wantsGroup) {
        if (!tournamentId) {
          errors += 1
          results.push({
            ...baseResult(digits, ''),
            status: 'error',
            error: 'Torneo requerido para asignar grupo',
          })
          await insertBulkRow(adminClient, {
            batchId,
            rowNumber: row.rowNumber,
            external_id: ext || null,
            full_name: name,
            role,
            groupName: rowGroupAudit,
            categoryName: cname,
            status: 'error',
            errorMessage: 'Torneo faltante para grupo',
          })
          continue
        }
        let gr = groupByNorm.get(gname.toLowerCase())
        if (!gr) {
          const { data: maxRow } = await adminClient
            .from('groups')
            .select('order_index')
            .eq('tournament_id', tournamentId)
            .order('order_index', { ascending: false })
            .limit(1)
            .maybeSingle()

          const nextOrd = maxRow ? ((maxRow as { order_index: number }).order_index + 1) : 0
          const { data: newG, error: cgErr } = await adminClient
            .from('groups')
            .insert({
              tournament_id: tournamentId,
              name: gname,
              order_index: nextOrd,
            })
            .select('id, max_players')
            .single()

          if (cgErr || !newG) {
            errors += 1
            const msg = cgErr?.message ?? 'No se pudo crear el grupo'
            results.push({
              ...baseResult(digits, ''),
              status: 'error',
              error: msg,
            })
            await insertBulkRow(adminClient, {
              batchId,
              rowNumber: row.rowNumber,
              externalId: ext || null,
              fullName: name,
              role,
              groupName: rowGroupAudit,
              categoryName: cname,
              status: 'error',
              errorMessage: msg,
            })
            continue
          }

          const ng = newG as { id: string; max_players: number | null }
          gr = { id: ng.id, max_players: ng.max_players }
          groupByNorm.set(gname.toLowerCase(), gr)
          tournamentGroupIds.push(gr.id)
          if (!liveGroupCount.has(gr.id)) liveGroupCount.set(gr.id, 0)
        }
        let alreadyInThisGroup = false
        if (existingProf) {
          const uidExisting = (existingProf as { id: string }).id
          alreadyInThisGroup = groupPlayerByUser.get(uidExisting)?.group_id === gr.id
        }
        const curCap = liveGroupCount.get(gr.id) ?? 0
        const cap = gr.max_players ?? 5
        if (!alreadyInThisGroup && curCap >= cap) {
          errors += 1
          results.push({
            ...baseResult(digits, ''),
            status: 'error',
            error: `El grupo "${gname}" está lleno (${cap})`,
          })
          await insertBulkRow(adminClient, {
            batchId,
            rowNumber: row.rowNumber,
            external_id: ext || null,
            full_name: name,
            role,
            groupName: rowGroupAudit,
            categoryName: cname,
            status: 'error',
            errorMessage: 'Grupo lleno',
          })
          continue
        }
        targetGroupId = gr.id
      }

      if (existingProf) {
        const uid = (existingProf as { id: string }).id

        const phoneTaken = profileByPhone.get(digits)
        if (phoneTaken && phoneTaken.id !== uid) {
          errors += 1
          results.push({
            ...baseResult(digits, ''),
            status: 'error',
            error: 'Ese celular ya está asignado a otro usuario',
          })
          await insertBulkRow(adminClient, {
            batchId,
            rowNumber: row.rowNumber,
            external_id: ext || null,
            full_name: name,
            role,
            groupName: rowGroupAudit,
            categoryName: cname,
            status: 'error',
            errorMessage: 'Celular duplicado',
          })
          continue
        }

        const profilePayload: Record<string, unknown> = {
          full_name: name,
          role,
          category_id: categoryId,
          status: rowAccountStatus,
          phone: digits,
        }
        if (ext) profilePayload.external_id = ext
        if (recoveryCheck.value) {
          profilePayload.email = recoveryCheck.value
          profilePayload.must_complete_email = false
        }
        if (pjVal !== null) profilePayload.import_carry_pj = pjVal
        if (ptsVal !== null) profilePayload.import_carry_pts = ptsVal

        const { error: upErr } = await adminClient.from('profiles').update(profilePayload).eq('id', uid)
        if (upErr) {
          errors += 1
          results.push({
            ...baseResult(digits, passwordRaw || '—'),
            status: 'error',
            error: upErr.message,
          })
          await insertBulkRow(adminClient, {
            batchId,
            rowNumber: row.rowNumber,
            external_id: ext || null,
            full_name: name,
            role,
            groupName: rowGroupAudit,
            categoryName: cname,
            status: 'error',
            errorMessage: upErr.message,
          })
          continue
        }

        if (passwordRaw) {
          const { error: pwErr } = await adminClient.auth.admin.updateUserById(uid, { password: passwordRaw })
          if (pwErr) {
            const msg = formatAuthPasswordError(pwErr.message)
            errors += 1
            results.push({
              ...baseResult(digits, passwordRaw),
              status: 'error',
              error: msg,
            })
            await insertBulkRow(adminClient, {
              batchId,
              rowNumber: row.rowNumber,
              externalId: ext || null,
              fullName: name,
              role,
              groupName: rowGroupAudit,
              categoryName: cname,
              status: 'error',
              errorMessage: msg,
            })
            continue
          }
          const credErr = await upsertVisiblePassword(adminClient, {
            userId: uid,
            password: passwordRaw,
            actorId: userData.user.id,
          })
          if (credErr) {
            errors += 1
            results.push({
              ...baseResult(digits, passwordRaw),
              status: 'error',
              error: credErr,
            })
            await insertBulkRow(adminClient, {
              batchId,
              rowNumber: row.rowNumber,
              externalId: ext || null,
              fullName: name,
              role,
              groupName: rowGroupAudit,
              categoryName: cname,
              status: 'error',
              errorMessage: credErr,
            })
            continue
          }
        }

        const gErr = await ensureGroupMembership(adminClient, {
          uid,
          name,
          targetGroupId,
          tournamentId,
          liveGroupCount,
          affectedGroupIds,
          tournamentGroupIds,
          existingMembershipByUser: groupPlayerByUser,
          matchCountByGroupPlayer,
        })
        if (gErr) {
          errors += 1
          results.push({
            ...baseResult(digits, passwordRaw || '—'),
            status: 'error',
            error: gErr,
          })
          await insertBulkRow(adminClient, {
            batchId,
            rowNumber: row.rowNumber,
            external_id: ext || null,
            full_name: name,
            role,
            groupName: rowGroupAudit,
            categoryName: cname,
            status: 'error',
            errorMessage: gErr,
          })
          continue
        }

        success += 1
        results.push({
          ...baseResult(digits, passwordRaw || '—'),
          status: 'success',
          userId: uid,
          operation: 'updated',
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          externalId: ext || null,
          fullName: name,
          role,
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'success',
          errorMessage: null,
          createdProfileId: uid,
        })
        continue
      }

      const { data: dupPhone } = await adminClient.from('profiles').select('id').eq('phone', digits).maybeSingle()
      if (dupPhone) {
        errors += 1
        results.push({
          ...baseResult(digits, ''),
          status: 'error',
          error: 'Ese celular ya está registrado',
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name,
          role,
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: 'Celular duplicado',
        })
        continue
      }

      const technicalEmail = technicalAuthEmailFromDigits(digits)

      const { data: created, error: authErr } = await adminClient.auth.admin.createUser({
        email: technicalEmail,
        password: passwordRaw,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          bulk_import: 'true',
          role,
          phone: digits,
          ...(categoryId ? { category_id: categoryId } : {}),
          ...(ext ? { external_id: ext } : {}),
        },
      })

      if (authErr || !created.user) {
        errors += 1
        const msg = formatAuthPasswordError(authErr?.message ?? 'Error creando usuario')
        results.push({
          ...baseResult(digits, passwordRaw),
          status: 'error',
          error: msg,
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name,
          role,
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: msg,
        })
        continue
      }

      const uid = created.user.id

      const recEmail = recoveryCheck.value
      const profilePayload: Record<string, unknown> = {
        full_name: name,
        role,
        external_id: ext || null,
        category_id: categoryId,
        phone: digits,
        status: rowAccountStatus,
        email_verified: false,
      }
      if (recEmail) {
        profilePayload.email = recEmail
        profilePayload.must_complete_email = false
      } else {
        profilePayload.email = null
        profilePayload.must_complete_email = true
      }
      if (pjVal !== null) profilePayload.import_carry_pj = pjVal
      if (ptsVal !== null) profilePayload.import_carry_pts = ptsVal

      const { error: upErr } = await adminClient.from('profiles').update(profilePayload).eq('id', uid)

      if (upErr) {
        errors += 1
        await adminClient.auth.admin.deleteUser(uid)
        results.push({
          ...baseResult(digits, passwordRaw),
          status: 'error',
          error: upErr.message,
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name,
          role,
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: upErr.message,
        })
        continue
      }

      const credErr = await upsertVisiblePassword(adminClient, {
        userId: uid,
        password: passwordRaw,
        actorId: userData.user.id,
      })
      if (credErr) {
        errors += 1
        await adminClient.auth.admin.deleteUser(uid)
        results.push({
          ...baseResult(digits, passwordRaw),
          status: 'error',
          error: credErr,
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name,
          role,
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: credErr,
        })
        continue
      }

      const gErr = await ensureGroupMembership(adminClient, {
        uid,
        name,
        targetGroupId,
        tournamentId,
        liveGroupCount,
        affectedGroupIds,
        tournamentGroupIds,
        existingMembershipByUser: groupPlayerByUser,
        matchCountByGroupPlayer,
      })
      if (gErr) {
        errors += 1
        await adminClient.auth.admin.deleteUser(uid)
        results.push({
          ...baseResult(digits, passwordRaw),
          status: 'error',
          error: gErr,
        })
        await insertBulkRow(adminClient, {
          batchId,
          rowNumber: row.rowNumber,
          external_id: ext || null,
          full_name: name,
          role,
          groupName: rowGroupAudit,
          categoryName: cname,
          status: 'error',
          errorMessage: gErr,
        })
        continue
      }

      success += 1
      results.push({
        ...baseResult(digits, passwordRaw),
        status: 'success',
        userId: uid,
        operation: 'created',
      })
      await insertBulkRow(adminClient, {
        batchId,
        rowNumber: row.rowNumber,
        external_id: ext || null,
        full_name: name,
        role,
        groupName: rowGroupAudit,
        categoryName: cname,
        status: 'success',
        errorMessage: null,
        createdProfileId: uid,
      })
    }

    delete auditClient.__bulkImportAuditRows
    if (auditRows.length) {
      const { error: auditErr } = await adminClient.from('bulk_import_rows').insert(auditRows)
      if (auditErr) console.warn('bulk_import_rows audit insert failed', auditErr.message)
    }

    await adminClient
      .from('bulk_import_batches')
      .update({
        success_rows: success,
        error_rows: errors,
        status: 'completed',
      })
      .eq('id', batchId)

    return ok({
      batchId,
      success,
      errors,
      results,
      affectedGroupIds: [...affectedGroupIds],
    })
  } catch (e) {
    console.error(e)
    return err(e instanceof Error ? e.message : 'Error interno', 500)
  }
})
