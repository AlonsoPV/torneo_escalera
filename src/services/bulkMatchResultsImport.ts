import Papa from 'papaparse'

import {
  CSV_STATUS_TO_MATCH_STATUS,
  MATCH_RESULTS_IMPORT_HEADERS,
  normalizeMatchResultsHeader,
  rowToAuditPayload,
} from '@/lib/matchResultsImportSpec'
import { supabase } from '@/lib/supabase'
import type { AdminGroupRecord, AdminMatchRecord } from '@/services/admin'
import { getTournamentRules } from '@/services/tournaments'
import type { Json, MatchGameType, MatchResultType, MatchStatus, ScoreSet } from '@/types/database'
import { pairKey } from '@/utils/matches'
import {
  validateBestOf3Score,
  validateLongSetScore,
  validateScoreWithRules,
} from '@/utils/score'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normKey(s: string): string {
  return s.trim().toLowerCase()
}

function looksLikeUuid(s: string): boolean {
  return UUID_RE.test(s.trim())
}

function parseOptionalGames(raw: string): number | null {
  const t = String(raw ?? '').trim()
  if (t === '' || t.toLowerCase() === 'null') return null
  if (!/^-?\d+$/.test(t)) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return n
}

function normalizeGameType(raw: string): MatchGameType | null {
  const k = raw.trim().toLowerCase().replace(/-/g, '_')
  if (k === 'best_of_3' || k === 'bestof3') return 'best_of_3'
  if (k === 'sudden_death' || k === 'suddendeath' || k === 'sudden death') return 'sudden_death'
  if (k === 'long_set' || k === 'longset') return 'long_set'
  return null
}

function mapCsvResultType(
  raw: string,
  winnerGp: string,
  matchCanonicalPlayerA: string,
): { resultType: MatchResultType; isWoOrDef: boolean } {
  const t = raw.trim().toLowerCase()
  if (t === 'wo' || t === 'walkover' || t === 'def' || t === 'default') {
    const resultType: MatchResultType = winnerGp === matchCanonicalPlayerA ? 'default_win_a' : 'default_win_b'
    return { resultType, isWoOrDef: true }
  }
  return { resultType: 'normal', isWoOrDef: false }
}

function resolveGroupPlayer(
  group: AdminGroupRecord,
  idToken: string,
  nameHint: string,
): { gpId: string | null; messages: string[] } {
  const messages: string[] = []
  const idT = idToken.trim()
  const nameN = normKey(nameHint)

  if (idT) {
    if (looksLikeUuid(idT)) {
      for (const p of group.players) {
        if (p.id === idT || p.user_id === idT) return { gpId: p.id, messages }
      }
    }
    const idLower = idT.toLowerCase()
    for (const p of group.players) {
      const ext = p.profile?.external_id?.trim()
      if (ext && ext.toLowerCase() === idLower) return { gpId: p.id, messages }
    }
  }

  if (nameN) {
    for (const p of group.players) {
      if (normKey(p.display_name) === nameN) return { gpId: p.id, messages }
      const fn = p.profile?.full_name
      if (fn && normKey(fn) === nameN) return { gpId: p.id, messages }
    }
  }

  messages.push(`No se encontró jugador (${idT || 'sin ID'} / ${nameHint || 'sin nombre'}) en el grupo.`)
  return { gpId: null, messages }
}

function findGroupByRow(
  groups: AdminGroupRecord[],
  tournamentName: string,
  categoryName: string,
  groupName: string,
): AdminGroupRecord | null {
  const tn = normKey(tournamentName)
  const cn = normKey(categoryName)
  const gn = normKey(groupName)

  for (const g of groups) {
    if (normKey(g.tournament?.name ?? '') !== tn) continue
    const gCat = normKey(g.category?.name ?? '')
    const catOk =
      gCat === cn || ((!g.group_category_id || !g.category) && (cn === '' || cn === '-' || cn === 'sin categoría'))
    if (!catOk) continue
    if (normKey(g.name) !== gn) continue
    return g
  }
  return null
}

function findMatchForPair(matches: AdminMatchRecord[], groupId: string, a: string, b: string): AdminMatchRecord | null {
  const key = pairKey(a, b)
  for (const m of matches) {
    if (m.group_id !== groupId) continue
    if (pairKey(m.player_a_id, m.player_b_id) === key) return m
  }
  return null
}

/** Parsea CSV con cabecera; normaliza nombres de columna. */
export function parseMatchResultsCsv(
  fileContent: string,
): { rows: Record<string, string>[]; parseErrors: string[]; headerErrors: string[] } {
  const parseErrors: string[] = []
  const parsed = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => normalizeMatchResultsHeader(h),
  })
  if (parsed.errors.length) {
    for (const e of parsed.errors) {
      parseErrors.push(e.message ?? 'Error CSV')
    }
  }
  const headerErrors: string[] = []
  const headers = parsed.meta.fields ?? []
  for (const req of MATCH_RESULTS_IMPORT_HEADERS) {
    if (!headers.includes(req)) headerErrors.push(`Falta columna: ${req}`)
  }
  const rows = (parsed.data ?? []).filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''))
  return { rows, parseErrors, headerErrors }
}

export type MatchResultsImportPreviewRow = {
  rowNumber: number
  cells: Record<string, string>
  state: 'ready' | 'error'
  messages: string[]
  resolved?: {
    matchId: string
    tournamentId: string
    scoreRaw: ScoreSet[] | null
    gameType: MatchGameType
    resultType: MatchResultType
    status: MatchStatus
    winnerGroupPlayerId: string | null
  }
}

const rulesCache = new Map<string, Awaited<ReturnType<typeof getTournamentRules>>>()

async function getRulesCached(tournamentId: string) {
  if (!rulesCache.has(tournamentId)) {
    rulesCache.set(tournamentId, await getTournamentRules(tournamentId))
  }
  return rulesCache.get(tournamentId) ?? null
}

export async function buildMatchResultsImportPreview(
  rows: Record<string, string>[],
  groups: AdminGroupRecord[],
  matches: AdminMatchRecord[],
): Promise<MatchResultsImportPreviewRow[]> {
  rulesCache.clear()
  const out: MatchResultsImportPreviewRow[] = []

  let rowNumber = 1
  for (const cells of rows) {
    const messages: string[] = []
    const tournamentName = String(cells.tournament_name ?? '').trim()
    const categoryName = String(cells.category_name ?? '').trim()
    const groupName = String(cells.group_name ?? '').trim()

    if (!tournamentName || !groupName) {
      messages.push('tournament_name y group_name son obligatorios.')
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }

    const group = findGroupByRow(groups, tournamentName, categoryName, groupName)
    if (!group || !group.tournament) {
      messages.push('No se encontró torneo/grupo/categoría coincidente.')
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }

    const tournamentId = group.tournament_id
    const resA = resolveGroupPlayer(group, String(cells.player_a_id ?? ''), String(cells.player_a_name ?? ''))
    const resB = resolveGroupPlayer(group, String(cells.player_b_id ?? ''), String(cells.player_b_name ?? ''))
    messages.push(...resA.messages.filter(Boolean))
    messages.push(...resB.messages.filter(Boolean))
    const aId = resA.gpId
    const bId = resB.gpId
    if (!aId) messages.push('Jugador A no resuelto.')
    if (!bId) messages.push('Jugador B no resuelto.')
    if (!aId || !bId) {
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }

    if (aId === bId) {
      messages.push('Jugador A y B deben ser distintos.')
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }

    const match = findMatchForPair(matches, group.id, aId, bId)
    if (!match) {
      messages.push('No existe partido RR para este par en el grupo. Genera cruces primero.')
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }

    const gameType = normalizeGameType(String(cells.game_type ?? ''))
    if (!gameType) {
      messages.push('game_type inválido (best_of_3, sudden_death, long_set).')
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }

    const csvStatusRaw = String(cells.status ?? '').trim().toLowerCase()
    const mapped = CSV_STATUS_TO_MATCH_STATUS[csvStatusRaw]
    if (!mapped) {
      messages.push(`status inválido: ${csvStatusRaw}`)
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }
    const status = mapped as MatchStatus

    const winnerIdCell = String(cells.winner_id ?? '').trim()
    let winnerGroupPlayerId: string | null = null
    if (winnerIdCell) {
      const resW = resolveGroupPlayer(group, winnerIdCell, '')
      messages.push(...resW.messages)
      winnerGroupPlayerId = resW.gpId
    }

    const csvResultToken = String(cells.result_type ?? 'normal').trim().toLowerCase()
    if (csvResultToken === 'cancelled') {
      messages.push('Use la columna status=cancelled; no result_type cancelled.')
    }

    if (status === 'cancelled') {
      winnerGroupPlayerId = null
    } else if (!winnerGroupPlayerId) {
      messages.push('winner_id obligatorio salvo partido cancelado.')
    }

    if (
      winnerGroupPlayerId &&
      winnerGroupPlayerId !== match.player_a_id &&
      winnerGroupPlayerId !== match.player_b_id
    ) {
      messages.push('winner_id debe ser el group_players.id de jugador A o B del partido.')
    }

    if (messages.length) {
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }

    const { resultType: mappedResult, isWoOrDef } =
      status !== 'cancelled' && winnerGroupPlayerId
        ? mapCsvResultType(String(cells.result_type ?? 'normal'), winnerGroupPlayerId, match.player_a_id)
        : { resultType: 'normal' as MatchResultType, isWoOrDef: false }

    const invertToCanonical = aId !== match.player_a_id

    const pullSet = (i: number): ScoreSet | null => {
      const keysA = [`set_${i}_a`, `set_${i}_b`] as const
      const ga = parseOptionalGames(String(cells[keysA[0]] ?? ''))
      const gb = parseOptionalGames(String(cells[keysA[1]] ?? ''))
      if (ga === null && gb === null) return null
      if (ga === null || gb === null) {
        messages.push(`Set ${i}: ambos games deben ser números o ambos vacíos.`)
        return null
      }
      if (!invertToCanonical) {
        return { a: ga, b: gb }
      }
      return { a: gb, b: ga }
    }

    let scoreRaw: ScoreSet[] | null = null
    let effectiveGameType: MatchGameType = gameType

    if (status === 'cancelled') {
      scoreRaw = null
    } else if (isWoOrDef || gameType === 'sudden_death') {
      scoreRaw = null
      if (isWoOrDef) effectiveGameType = 'sudden_death'
    } else if (gameType === 'long_set') {
      const s = pullSet(1)
      if (!s) {
        messages.push('long_set requiere set_1_a y set_1_b.')
      } else {
        const val = validateLongSetScore(s)
        if (!val.ok) messages.push(...val.errors)
        else scoreRaw = [s]
      }
    } else {
      const sets: ScoreSet[] = []
      for (let i = 1; i <= 3; i += 1) {
        const s = pullSet(i)
        if (s) sets.push(s)
      }
      if (sets.length === 0) {
        messages.push('best_of_3 requiere al menos un set con games.')
      } else {
        const val = validateBestOf3Score(sets)
        if (!val.ok) messages.push(...val.errors)
        else {
          const rules = await getRulesCached(tournamentId)
          if (!rules) messages.push('No hay reglas del torneo.')
          else {
            const rv = validateScoreWithRules(sets, rules)
            if (!rv.ok) messages.push(...rv.errors)
            else scoreRaw = sets
          }
        }
      }
    }

    if (messages.length) {
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }

    out.push({
      rowNumber,
      cells,
      state: 'ready',
      messages: [],
      resolved: {
        matchId: match.id,
        tournamentId,
        scoreRaw,
        gameType: effectiveGameType,
        resultType: mappedResult,
        status,
        winnerGroupPlayerId,
      },
    })
    rowNumber += 1
  }

  return out
}

function mapPgError(e: { message: string }): string {
  return e.message
}

export type ApplyMatchResultsImportResult = {
  batchId: string
  success: number
  errors: number
  rowDetails: { rowNumber: number; ok: boolean; message?: string }[]
}

/** Ejecuta filas listas; registra lote y filas en tablas de auditoría. */
export async function applyMatchResultsImport(input: {
  fileName: string | null
  uploadedBy: string
  rows: MatchResultsImportPreviewRow[]
}): Promise<ApplyMatchResultsImportResult> {
  const total = input.rows.length

  const { data: batch, error: batchErr } = await supabase
    .from('match_results_import_batches')
    .insert({
      file_name: input.fileName,
      uploaded_by: input.uploadedBy,
      total_rows: total,
      success_rows: 0,
      error_rows: 0,
      status: 'processing',
    })
    .select('id')
    .single()

  if (batchErr || !batch) {
    throw new Error(batchErr ? mapPgError(batchErr) : 'No se pudo crear el lote de importación.')
  }

  const batchId = batch.id
  let success = 0
  let errors = 0
  const rowDetails: { rowNumber: number; ok: boolean; message?: string }[] = []

  for (const pr of input.rows) {
    const payload = rowToAuditPayload(pr.cells) as Json
    if (pr.state !== 'ready' || !pr.resolved) {
      errors += 1
      rowDetails.push({ rowNumber: pr.rowNumber, ok: false, message: pr.messages.join(' ') })
      await supabase.from('match_results_import_rows').insert({
        batch_id: batchId,
        row_number: pr.rowNumber,
        status: 'error',
        error_message: pr.messages.join(' | ') || 'Fila no lista',
        match_id: null,
        payload,
      })
      continue
    }

    const r = pr.resolved

    try {
      if (r.status === 'cancelled') {
        const { error: upErr } = await supabase
          .from('matches')
          .update({
            status: 'cancelled',
            winner_id: null,
            score_raw: null,
            result_type: 'normal',
            updated_by: input.uploadedBy,
            updated_at: new Date().toISOString(),
            closed_at: null,
            admin_validated_at: null,
            admin_validated_by: null,
          })
          .eq('id', r.matchId)
        if (upErr) throw new Error(mapPgError(upErr))
      } else {
        const pScore = (r.gameType === 'sudden_death' ? null : r.scoreRaw) as Json | null
        const winner = r.winnerGroupPlayerId
        if (!winner) throw new Error('Falta ganador.')

        const { error: rpcErr } = await supabase.rpc('admin_set_match_result', {
          p_match_id: r.matchId,
          p_score: pScore,
          p_winner_id: winner,
          p_status: r.status,
          p_result_type: r.resultType,
          p_game_type: r.gameType,
        })
        if (rpcErr) throw new Error(mapPgError(rpcErr))
      }

      success += 1
      rowDetails.push({ rowNumber: pr.rowNumber, ok: true })
      await supabase.from('match_results_import_rows').insert({
        batch_id: batchId,
        row_number: pr.rowNumber,
        status: 'success',
        error_message: null,
        match_id: r.matchId,
        payload,
      })
    } catch (e) {
      errors += 1
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      rowDetails.push({ rowNumber: pr.rowNumber, ok: false, message: msg })
      await supabase.from('match_results_import_rows').insert({
        batch_id: batchId,
        row_number: pr.rowNumber,
        status: 'error',
        error_message: msg,
        match_id: r.matchId,
        payload,
      })
    }
  }

  await supabase
    .from('match_results_import_batches')
    .update({
      success_rows: success,
      error_rows: errors,
      status: 'completed',
    })
    .eq('id', batchId)

  return { batchId, success, errors, rowDetails }
}
