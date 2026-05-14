import Papa from 'papaparse'
import * as XLSX from 'xlsx'

import { recoverFromAuthError } from '@/lib/authSessionRecovery'
import { normalizePhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import type { BulkImportContext, BulkImportGroupMeta, BulkImportParsedRow } from '@/lib/bulkUserImportPreview'
import { normalizeImportLabel } from '@/lib/userImportTemplate'
import type { Tournament } from '@/types/database'

function normKey(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function getCell(row: Record<string, unknown>, candidates: string[]): string {
  const keys = Object.keys(row)
  for (const c of candidates) {
    const want = normKey(c)
    for (const k of keys) {
      if (normKey(k) === want) return String(row[k] ?? '').trim()
    }
  }
  return ''
}

/** Celda de contraseña: en Excel suele venir como número. */
function getPasswordCell(row: Record<string, unknown>, candidates: string[]): string {
  const keys = Object.keys(row)
  for (const c of candidates) {
    const want = normKey(c)
    for (const k of keys) {
      if (normKey(k) !== want) continue
      const v = row[k]
      if (v === null || v === undefined) return ''
      if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v))
      return String(v).trim()
    }
  }
  return ''
}

/** Valores numéricos enteros desde Excel. */
function getOptionalIntCell(row: Record<string, unknown>, candidates: string[]): string {
  return getPasswordCell(row, candidates)
}

function mapSheetRow(row: Record<string, unknown>, rowNumber: number): BulkImportParsedRow {
  return {
    rowNumber,
    externalId: getCell(row, ['ID', 'Id', 'id', 'external_id', 'External id']),
    phone: getPasswordCell(row, [
      'Celular',
      'celular',
      'Teléfono',
      'Telefono',
      'telefono',
      'Móvil',
      'Movil',
      'movil',
      'Tel',
      'tel',
    ]),
    fullName: getCell(row, ['Nombre', 'nombre', 'name', 'Full name']),
    role: getCell(row, ['Rol', 'rol', 'role']),
    categoryName: getCell(row, ['Categoría', 'Categoria', 'categoria', 'category', 'Category']),
    password: getPasswordCell(row, ['Contraseña', 'Contrasena', 'contrasena', 'password', 'Password', 'clave', 'Clave']),
    groupName: getCell(row, ['Grupo', 'grupo', 'group', 'Group name']),
    pj: getOptionalIntCell(row, ['PJ', 'pj', 'Partidos jugados', 'partidos jugados', 'Partidos Jugados']),
    pts: getOptionalIntCell(row, ['Pts', 'pts', 'PTS', 'Puntos', 'puntos']),
  }
}

export async function parseUserImportFile(file: File): Promise<BulkImportParsedRow[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) {
    const text = await file.text()
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })
    if (parsed.errors.length) {
      throw new Error(parsed.errors[0]?.message ?? 'CSV inválido')
    }
    return (parsed.data ?? []).map((row, i) => mapSheetRow(row, i + 2))
  }

  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error('El Excel no tiene hojas.')
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  return json.map((row, i) => mapSheetRow(row, i + 2))
}

export async function fetchBulkImportPoolContext(tournamentId: string | null): Promise<BulkImportContext> {
  const { data: cats, error: cErr } = await supabase.from('player_categories').select('name')
  if (cErr) throw cErr

  const categoryNamesLower = new Set(
    (cats ?? []).map((c) => normalizeImportLabel(String((c as { name: string }).name)).toLowerCase()),
  )

  const { data: extProf, error: eErr } = await supabase
    .from('profiles')
    .select('external_id')
    .not('external_id', 'is', null)
  if (eErr) throw eErr

  const externalIdsInUse = new Set(
    (extProf ?? [])
      .map((p) => String((p as { external_id: string }).external_id).trim().toLowerCase())
      .filter(Boolean),
  )

  const { data: phoneProf, error: pErr } = await supabase.from('profiles').select('phone').not('phone', 'is', null)
  if (pErr) throw pErr

  const phonesInUse = new Set<string>()
  for (const row of phoneProf ?? []) {
    const raw = String((row as { phone: string }).phone ?? '').trim()
    const n = normalizePhone(raw)
    if (n.ok) phonesInUse.add(n.digits)
  }

  const groupsByNorm = new Map<string, BulkImportGroupMeta>()
  const tid = tournamentId?.trim() || null
  if (tid) {
    const { data: groups, error: gErr } = await supabase
      .from('groups')
      .select('id, name, max_players')
      .eq('tournament_id', tid)
      .order('order_index', { ascending: true })
    if (gErr) throw gErr
    const groupList = (groups ?? []) as { id: string; name: string; max_players: number | null }[]
    const groupIds = groupList.map((g) => g.id)
    const counts = new Map<string, number>()
    if (groupIds.length) {
      const { data: gp, error: gpErr } = await supabase.from('group_players').select('group_id').in('group_id', groupIds)
      if (gpErr) throw gpErr
      for (const r of gp ?? []) {
        const gid = (r as { group_id: string }).group_id
        counts.set(gid, (counts.get(gid) ?? 0) + 1)
      }
    }
    for (const g of groupList) {
      groupsByNorm.set(normalizeImportLabel(g.name).toLowerCase(), {
        id: g.id,
        name: g.name,
        playerCount: counts.get(g.id) ?? 0,
        maxPlayers: g.max_players ?? 5,
      })
    }
  }

  return { categoryNamesLower, externalIdsInUse, phonesInUse, groupsByNorm }
}

export async function listTournamentsForBulkImport(): Promise<Tournament[]> {
  const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Tournament[]
}

export type BulkImportInvokeRow = {
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
}

export type BulkImportResultRow = {
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

export type BulkImportResponse = {
  batchId: string
  success: number
  errors: number
  affectedGroupIds: string[]
  results: BulkImportResultRow[]
}

/** Respuesta agregada cuando la importación se envía en varios lotes (progreso en cliente). */
export type BulkImportMergedResponse = BulkImportResponse & {
  batchIds: string[]
}

export async function invokeBulkCreateUsers(input: {
  tournamentId?: string | null
  fileName?: string
  createMissingCategories?: boolean
  rows: BulkImportInvokeRow[]
  signal?: AbortSignal
}): Promise<BulkImportResponse> {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
  if (sessionErr) {
    if (await recoverFromAuthError(sessionErr)) {
      throw new Error('Sesión no válida. Redirigiendo al login…')
    }
    throw new Error(sessionErr.message)
  }
  const accessToken = sessionData.session?.access_token
  if (!accessToken) {
    throw new Error('Inicia sesión para importar usuarios.')
  }
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!anonKey) throw new Error('Falta VITE_SUPABASE_ANON_KEY')

  const { data, error } = await supabase.functions.invoke<BulkImportResponse>('admin-bulk-create-users', {
    body: {
      tournamentId: input.tournamentId ?? null,
      fileName: input.fileName,
      createMissingCategories: input.createMissingCategories,
      rows: input.rows,
    },
    signal: input.signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
  })
  if (error) {
    if (await recoverFromAuthError(error)) {
      throw new Error('Sesión no válida. Redirigiendo al login…')
    }
    throw new Error(error.message)
  }
  const payload = data as Record<string, unknown> | null
  if (!payload || typeof payload.batchId !== 'string') {
    const msg =
      typeof payload?.error === 'string'
        ? payload.error
        : 'Respuesta inválida de la función (¿desplegaste admin-bulk-create-users?)'
    throw new Error(msg)
  }
  return payload as unknown as BulkImportResponse
}

const DEFAULT_IMPORT_CHUNK = 40

/**
 * Envía filas en varias peticiones (tamaño máx. servidor 200) para mostrar progreso real en la UI.
 * Entre lotes el servidor ya persistió categorías/grupos; los siguientes lotes reutilizan el mismo estado.
 */
export async function invokeBulkCreateUsersChunked(
  input: {
    tournamentId?: string | null
    fileName?: string
    createMissingCategories?: boolean
    rows: BulkImportInvokeRow[]
    signal?: AbortSignal
  },
  options?: {
    chunkSize?: number
    onProgress?: (info: {
      completedRows: number
      totalRows: number
      chunkIndex: number
      chunkTotal: number
      phase: 'upload' | 'done_chunk'
    }) => void
  },
): Promise<BulkImportMergedResponse> {
  const { rows, signal, ...rest } = input
  if (!rows.length) throw new Error('No hay filas para importar')

  const chunkSize = Math.min(options?.chunkSize ?? DEFAULT_IMPORT_CHUNK, 200)
  const chunks: BulkImportInvokeRow[][] = []
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize))
  }

  const batchIds: string[] = []
  let success = 0
  let errors = 0
  const results: BulkImportResultRow[] = []
  const affectedGroupIds = new Set<string>()
  const totalRows = rows.length
  let completedRows = 0

  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) {
      throw new DOMException('Importación cancelada', 'AbortError')
    }
    options?.onProgress?.({
      completedRows,
      totalRows,
      chunkIndex: i,
      chunkTotal: chunks.length,
      phase: 'upload',
    })

    const part = await invokeBulkCreateUsers({
      ...rest,
      rows: chunks[i],
      fileName:
        chunks.length === 1
          ? rest.fileName
          : `${rest.fileName ?? 'importacion'} — parte ${i + 1}/${chunks.length}`,
      signal,
    })

    batchIds.push(part.batchId)
    success += part.success
    errors += part.errors
    results.push(...part.results)
    for (const gid of part.affectedGroupIds ?? []) {
      affectedGroupIds.add(gid)
    }
    completedRows += chunks[i].length

    options?.onProgress?.({
      completedRows,
      totalRows,
      chunkIndex: i + 1,
      chunkTotal: chunks.length,
      phase: 'done_chunk',
    })
  }

  return {
    batchId: batchIds[0] ?? '',
    batchIds,
    success,
    errors,
    results,
    affectedGroupIds: [...affectedGroupIds],
  }
}
