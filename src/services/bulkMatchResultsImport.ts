import Papa from 'papaparse'

import {
  CSV_STATUS_TO_MATCH_STATUS,
  MATCH_RESULTS_IMPORT_HEADERS,
  normalizeMatchResultsHeader,
  rowToAuditPayload,
} from '@/lib/matchResultsImportSpec'
import { normalizeImportCategoryName } from '@/services/matchResultsImportStructure'
import {
  IMPORT_ADMIN_PENALTY_SCORE,
  importResultTypeAllowsNullWinner,
} from '@/lib/matchResultSemantics'
import { invokeAdminImportResults } from '@/services/authEdge'
import { supabase } from '@/lib/supabase'
import { getAdminGroups, type AdminGroupRecord, type AdminMatchRecord } from '@/services/admin'
import { generateRoundRobinMatches } from '@/services/matches'
import { listGroupPlayers } from '@/services/groups'
import type { Json, MatchGameType, MatchResultType, MatchStatus, Profile, ScoreSet, TournamentRules } from '@/types/database'
import { pairKey } from '@/utils/matches'
import { validateBestOf3Score, validateIncompleteBestOf3Score, validateSuddenDeathMatchScore } from '@/utils/score'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Lotes hacia la Edge Function `admin-import-results` (un POST por chunk). */
export const MATCH_RESULTS_EDGE_CHUNK_SIZE = 80

export type MatchResultsImportPreviewOptions = {
  /** Modo torneo histórico: formatos operativos, cierre forzado, tie-break corto decisivo, penalizaciones. */
  historicalImportMode?: boolean
}

function normKey(s: string): string {
  return s.trim().toLowerCase()
}

/** Quita marcas diacríticas para alinear CSV con nombres en BD (ANDRÉS GÓMEZ vs ANDRES GOMEZ). */
function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '')
}

export function normImportPlayerName(s: string): string {
  return stripDiacritics(s.trim().toLowerCase()).replace(/\s+/g, ' ')
}

/** Coincidencia laxa de IDs externos numéricos (82 vs 082). */
function externalIdsEquivalent(csvToken: string, stored: string): boolean {
  const a = csvToken.trim().toLowerCase()
  const b = stored.trim().toLowerCase()
  if (a === b) return true
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    const na = a.replace(/^0+/, '') || '0'
    const nb = b.replace(/^0+/, '') || '0'
    return na === nb
  }
  return false
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
  const k = raw.trim().toLowerCase().replace(/-/g, '_').replace(/\./g, '')
  if (k === 'best_of_3' || k === 'bestof3' || k === 'bo3') return 'best_of_3'
  if (k === 'best_of_3_short_tiebreak' || k === 'bestof3short' || k === 'bo3_short' || k === 'bo3short') {
    return 'best_of_3_short_tiebreak'
  }
  if (k === 'sudden_death' || k === 'suddendeath' || k === 'sudden death') return 'sudden_death'
  if (k === 'long_set' || k === 'longset') return 'long_set'
  return null
}

/** Normaliza token CSV de result_type → tipo persistido en BD. */
function normalizeImportResultTypeToken(raw: string): MatchResultType | null {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
  if (t === '' || t === 'normal') return 'normal'

  const map: Record<string, MatchResultType> = {
    wo: 'wo',
    walkover: 'wo',
    w_o: 'wo',
    def: 'def',
    default: 'def',
    nr: 'not_reported',
    n_r: 'not_reported',
    not_reported: 'not_reported',
    ret: 'retired',
    retired: 'retired',
    ret_draw: 'retired_draw',
    retdraw: 'retired_draw',
    retireddraw: 'retired_draw',
    retired_draw: 'retired_draw',
    retiro_empate: 'retired_draw',
    retiroempate: 'retired_draw',
    pending_score: 'pending_score',
    pending: 'pending_score',
    double_penalty: 'double_penalty',
  }
  return map[t] ?? null
}

function cellsHaveNumericSets(cells: Record<string, string>): boolean {
  for (let i = 1; i <= 3; i += 1) {
    const ga = parseOptionalGames(String(cells[`set_${i}_a`] ?? ''))
    const gb = parseOptionalGames(String(cells[`set_${i}_b`] ?? ''))
    if (ga !== null || gb !== null) return true
  }
  return false
}

function resolveGroupPlayer(
  group: AdminGroupRecord,
  idToken: string,
  nameHint: string,
): { gpId: string | null; messages: string[] } {
  const messages: string[] = []
  const idT = idToken.trim()

  if (idT) {
    if (looksLikeUuid(idT)) {
      for (const p of group.players) {
        if (p.id === idT || p.user_id === idT) return { gpId: p.id, messages }
      }
    }
    for (const p of group.players) {
      const ext = p.profile?.external_id?.trim()
      if (ext && externalIdsEquivalent(idT, ext)) return { gpId: p.id, messages }
    }
  }

  const nameFolded = nameHint.trim() ? normImportPlayerName(nameHint) : ''
  if (nameFolded) {
    for (const p of group.players) {
      if (normImportPlayerName(p.display_name) === nameFolded) return { gpId: p.id, messages }
      const fn = p.profile?.full_name
      if (fn && normImportPlayerName(fn) === nameFolded) return { gpId: p.id, messages }
    }
  }

  messages.push(`No se encontró jugador (${idT || 'sin ID'} / ${nameHint || 'sin nombre'}) en el grupo.`)
  return { gpId: null, messages }
}

function groupCategoryNormKey(g: AdminGroupRecord): string | null {
  const raw = g.category?.name?.trim()
  return raw ? normKey(raw) : null
}

/**
 * Localiza el grupo del CSV en datos admin ya cargados.
 * Si hay varios grupos con el mismo nombre en el torneo, prioriza la categoría del CSV;
 * si no hay coincidencia de categoría, usa el primero y la sincronización (`syncMatchResultsImportStructure`)
 * alineará `group_category_id` en servidor.
 */
export function findGroupForMatchResultsImport(
  groups: AdminGroupRecord[],
  tournamentName: string,
  categoryName: string,
  groupName: string,
): AdminGroupRecord | null {
  const tn = normKey(tournamentName)
  const gn = normKey(groupName)

  const inTournament = groups.filter((g) => normKey(g.tournament?.name ?? '') === tn)
  const sameName = inTournament.filter((g) => normKey(g.name) === gn)
  if (sameName.length === 0) return null
  if (sameName.length === 1) return sameName[0]

  const csvNorm = normalizeImportCategoryName(categoryName)
  const csvKey = csvNorm ? normKey(csvNorm) : null

  if (csvKey === null) {
    const uncategorized = sameName.filter((g) => !g.group_category_id)
    return uncategorized[0] ?? sameName[0]
  }

  const exact = sameName.filter((g) => groupCategoryNormKey(g) === csvKey)
  if (exact.length >= 1) return exact[0]

  return sameName[0]
}

/**
 * Garantiza filas `matches` RR para cada grupo citado en el CSV (relleno incremental).
 * Evita errores «No existe partido RR…» cuando ya hay jugadores pero faltó generar cruces.
 */
export async function ensureRoundRobinMatchesForMatchResultsCsv(
  rows: Record<string, string>[],
  uploadedBy: string,
): Promise<{ groupsTouched: number; matchesInserted: number; messages: string[] }> {
  const messages: string[] = []
  let matchesInserted = 0
  let groupsTouched = 0

  const groups = await getAdminGroups()
  const seenGroupIds = new Set<string>()

  for (const cells of rows) {
    const tournamentName = String(cells.tournament_name ?? '').trim()
    const categoryName = String(cells.category_name ?? '').trim()
    const groupName = String(cells.group_name ?? '').trim()
    if (!tournamentName || !groupName) continue
    const g = findGroupForMatchResultsImport(groups, tournamentName, categoryName, groupName)
    if (g?.id) seenGroupIds.add(g.id)
  }

  for (const groupId of seenGroupIds) {
    const g = groups.find((x) => x.id === groupId)
    const tournamentId = g?.tournament_id
    if (!tournamentId) continue

    const players = await listGroupPlayers(groupId)
    if (players.length < 2) continue

    try {
      const n = await generateRoundRobinMatches({
        tournamentId,
        groupId,
        players,
        createdBy: uploadedBy,
        mode: 'fill',
      })
      if (n > 0) {
        matchesInserted += n
        groupsTouched += 1
        messages.push(`Se generaron ${n} partido(s) RR en «${g?.name ?? groupId}».`)
      }
    } catch (e) {
      messages.push(`«${g?.name ?? groupId}»: ${e instanceof Error ? e.message : 'error al generar RR'}`)
    }
  }

  return { groupsTouched, matchesInserted, messages }
}

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
  /** Avisos / normalizaciones (no bloquean la fila). */
  infoMessages?: string[]
  previewKind?: 'clean' | 'normalized' | 'warning' | 'penalty'
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

export async function buildMatchResultsImportPreview(
  rows: Record<string, string>[],
  groups: AdminGroupRecord[],
  matches: AdminMatchRecord[],
  options?: MatchResultsImportPreviewOptions,
): Promise<MatchResultsImportPreviewRow[]> {
  const historicalImportMode = options?.historicalImportMode ?? false
  const out: MatchResultsImportPreviewRow[] = []

  const matchByGroupPair = new Map<string, AdminMatchRecord>()
  for (const m of matches) {
    matchByGroupPair.set(`${m.group_id}:${pairKey(m.player_a_id, m.player_b_id)}`, m)
  }

  async function hydrateAdminGroupProfilesInline(g: AdminGroupRecord): Promise<AdminGroupRecord> {
    const missingIds = g.players.filter((pl) => !pl.profile).map((pl) => pl.user_id)
    if (missingIds.length === 0) return g
    const { data, error } = await supabase.from('profiles').select('*').in('id', missingIds)
    if (error) throw error
    const pmap = new Map((data ?? []).map((row) => [row.id, row as Profile]))
    return {
      ...g,
      players: g.players.map((pl) => ({
        ...pl,
        profile: pl.profile ?? pmap.get(pl.user_id) ?? null,
      })),
    }
  }

  const referencedGroupIds = new Set<string>()
  for (const cells of rows) {
    const tournamentName = String(cells.tournament_name ?? '').trim()
    const categoryName = String(cells.category_name ?? '').trim()
    const groupName = String(cells.group_name ?? '').trim()
    if (!tournamentName || !groupName) continue
    const gr = findGroupForMatchResultsImport(groups, tournamentName, categoryName, groupName)
    if (gr) referencedGroupIds.add(gr.id)
  }

  const hydratedByGroupId = new Map<string, AdminGroupRecord>()
  await Promise.all(
    [...referencedGroupIds].map(async (gid) => {
      const raw = groups.find((x) => x.id === gid)
      if (raw) hydratedByGroupId.set(gid, await hydrateAdminGroupProfilesInline(raw))
    }),
  )

  const tournamentIdsReferenced = new Set<string>()
  for (const gid of referencedGroupIds) {
    const raw = groups.find((x) => x.id === gid)
    if (raw?.tournament_id) tournamentIdsReferenced.add(raw.tournament_id)
  }
  const rulesByTournamentId = new Map<string, TournamentRules>()
  if (tournamentIdsReferenced.size > 0) {
    const { data: ruleRows, error: rulesErr } = await supabase
      .from('tournament_rules')
      .select('*')
      .in('tournament_id', [...tournamentIdsReferenced])
    if (rulesErr) throw rulesErr
    for (const row of ruleRows ?? []) {
      rulesByTournamentId.set((row as TournamentRules).tournament_id, row as TournamentRules)
    }
  }

  /** Primera fila en la que aparece cada pareja (grupo + jugadores); evita duplicados A vs B repetidos. */
  const firstRowByGroupPair = new Map<string, number>()

  let rowNumber = 1
  for (const cells of rows) {
    const messages: string[] = []
    const infoMessages: string[] = []
    let previewKind: MatchResultsImportPreviewRow['previewKind'] = 'clean'

    const bumpKind = (next: NonNullable<MatchResultsImportPreviewRow['previewKind']>) => {
      const rank = { clean: 0, normalized: 1, warning: 2, penalty: 3 }
      if (rank[next] > rank[previewKind ?? 'clean']) previewKind = next
    }

    const tournamentName = String(cells.tournament_name ?? '').trim()
    const categoryName = String(cells.category_name ?? '').trim()
    const groupName = String(cells.group_name ?? '').trim()

    if (!tournamentName || !groupName) {
      messages.push('tournament_name y group_name son obligatorios.')
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }

    const groupRaw = findGroupForMatchResultsImport(groups, tournamentName, categoryName, groupName)
    if (!groupRaw || !groupRaw.tournament) {
      messages.push('No se encontró torneo/grupo/categoría coincidente.')
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }

    const group = hydratedByGroupId.get(groupRaw.id) ?? (await hydrateAdminGroupProfilesInline(groupRaw))
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

    const dedupeKey = `${group.id}:${pairKey(aId, bId)}`
    const firstDupRow = firstRowByGroupPair.get(dedupeKey)
    if (firstDupRow !== undefined) {
      messages.push(
        `Este cruce está repetido en el archivo (misma pareja y grupo que la fila ${firstDupRow}). Quita la fila duplicada.`,
      )
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }
    firstRowByGroupPair.set(dedupeKey, rowNumber)

    const match = matchByGroupPair.get(`${group.id}:${pairKey(aId, bId)}`) ?? null
    if (!match) {
      messages.push('No existe partido RR para este par en el grupo. Genera cruces primero.')
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
    const mappedStatus = mapped as MatchStatus

    const csvResultRaw = String(cells.result_type ?? 'normal').trim()
    if (csvResultRaw.toLowerCase() === 'cancelled') {
      messages.push('Use la columna status=cancelled; no result_type cancelled.')
    }

    const declaredResult = normalizeImportResultTypeToken(csvResultRaw)
    if (declaredResult === null) {
      messages.push(`result_type inválido: ${csvResultRaw}`)
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }

    const winnerIdCell = String(cells.winner_id ?? '').trim()
    let winnerGroupPlayerId: string | null = null
    if (winnerIdCell) {
      const resW = resolveGroupPlayer(group, winnerIdCell, '')
      messages.push(...resW.messages)
      winnerGroupPlayerId = resW.gpId
    }

    const gameTypeParsed = normalizeGameType(String(cells.game_type ?? ''))
    if (!gameTypeParsed) {
      messages.push('game_type inválido (best_of_3, best_of_3_short_tiebreak, sudden_death, long_set).')
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }

    const anySets = cellsHaveNumericSets(cells)
    const hasWinnerCell = Boolean(winnerIdCell)

    let effectiveResultType: MatchResultType = declaredResult
    const openPendingWithoutScore =
      mappedStatus === 'pending_score' &&
      !hasWinnerCell &&
      !anySets &&
      (declaredResult === 'pending_score' || declaredResult === 'normal')

    const effectiveStatus: MatchStatus = openPendingWithoutScore
      ? 'pending_score'
      :
      mappedStatus === 'cancelled'
        ? 'cancelled'
        : historicalImportMode
          ? 'closed'
          : mappedStatus

    let penaltyClosure = false
    if (openPendingWithoutScore) {
      effectiveResultType = 'normal'
      infoMessages.push('Partido abierto importado sin marcador; queda disponible para captura posterior.')
      bumpKind('normalized')
    } else if (
      effectiveResultType === 'not_reported' ||
      effectiveResultType === 'double_penalty' ||
      effectiveResultType === 'pending_score'
    ) {
      penaltyClosure = true
    } else if (
      historicalImportMode &&
      mappedStatus === 'pending_score' &&
      !(hasWinnerCell && anySets) &&
      effectiveResultType !== 'wo' &&
      effectiveResultType !== 'def' &&
      effectiveResultType !== 'retired'
    ) {
      penaltyClosure = true
      effectiveResultType = effectiveResultType === 'normal' ? 'pending_score' : effectiveResultType
      infoMessages.push(
        'Estado CSV pending_score interpretado como partido no reportado · penalización administrativa (histórico).',
      )
      bumpKind('penalty')
    } else if (
      historicalImportMode &&
      mappedStatus !== 'cancelled' &&
      effectiveResultType === 'normal' &&
      !hasWinnerCell &&
      !anySets
    ) {
      penaltyClosure = true
      effectiveResultType = 'not_reported'
      infoMessages.push('Sin marcador ni ganador: tratado como N.R → penalización −1 / −1.')
      bumpKind('penalty')
    }

    if (effectiveResultType === 'retired' && !anySets) {
      penaltyClosure = true
      effectiveResultType = 'not_reported'
      winnerGroupPlayerId = null
      infoMessages.push('RET sin games: tratado como N.R → penalización −1 / −1.')
      bumpKind('penalty')
    }

    if (effectiveResultType === 'def' && !winnerGroupPlayerId) {
      if (historicalImportMode) {
        penaltyClosure = true
        effectiveResultType = 'double_penalty'
        infoMessages.push('DEF sin ganador claro → doble penalización administrativa.')
        bumpKind('penalty')
      } else {
        messages.push('DEF requiere winner_id.')
      }
    }

    if (effectiveResultType === 'wo' && !penaltyClosure && !winnerGroupPlayerId) {
      messages.push('W.O requiere winner_id.')
    }

    if (penaltyClosure) {
      winnerGroupPlayerId = null
    }

    if (effectiveStatus === 'cancelled') {
      winnerGroupPlayerId = null
    } else if (
      !openPendingWithoutScore &&
      !penaltyClosure &&
      !importResultTypeAllowsNullWinner(effectiveResultType) &&
      !winnerGroupPlayerId
    ) {
      const mayInferWinnerFromScoreLater =
        anySets && (effectiveResultType === 'normal' || effectiveResultType === 'retired')
      if (!mayInferWinnerFromScoreLater) {
        messages.push(
          'Falta winner_id para este resultado. En partidos normales cerrados el ganador es obligatorio (salvo cancelado, no reportado o penalización mutua).',
        )
      }
    }

    if (
      winnerGroupPlayerId &&
      winnerGroupPlayerId !== match.player_a_id &&
      winnerGroupPlayerId !== match.player_b_id
    ) {
      messages.push('El winner_id no pertenece a este partido (debe ser el id de jugador A o B del cruce).')
    }

    if (messages.length) {
      out.push({ rowNumber, cells, state: 'error', messages })
      rowNumber += 1
      continue
    }

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
    let effectiveGameType: MatchGameType = gameTypeParsed

    if (openPendingWithoutScore) {
      scoreRaw = null
    } else if (effectiveStatus === 'cancelled') {
      scoreRaw = null
    } else if (penaltyClosure) {
      scoreRaw = IMPORT_ADMIN_PENALTY_SCORE.map((s) => ({ ...s }))
      effectiveGameType = 'best_of_3'
      if (!infoMessages.some((m) => m.includes('administrativo'))) {
        infoMessages.push('Marcador administrativo aplicado: 3-6, 3-6 · −1 pts cada jugador.')
      }
      bumpKind('penalty')
    } else if (
      effectiveResultType === 'wo' ||
      effectiveResultType === 'def'
    ) {
      scoreRaw = null
      effectiveGameType = 'sudden_death'
      if (effectiveResultType === 'wo') {
        infoMessages.push('W.O detectado · sin games registrados.')
        bumpKind('normalized')
      } else {
        infoMessages.push('DEF detectado · sin games registrados.')
        bumpKind('normalized')
      }
    } else if (effectiveResultType === 'retired' || effectiveResultType === 'retired_draw') {
      const retiredSets: ScoreSet[] = []
      for (let i = 1; i <= 3; i += 1) {
        const s = pullSet(i)
        if (s) retiredSets.push(s)
      }
      const valRet = validateIncompleteBestOf3Score(retiredSets)
      if (!valRet.ok) {
        messages.push(...valRet.errors)
      } else {
        scoreRaw = retiredSets
        effectiveGameType = 'best_of_3'
        if (effectiveResultType === 'retired_draw') {
          if (valRet.games.a !== valRet.games.b) {
            messages.push('RET empate: ambos jugadores deben tener la misma cantidad total de games.')
          } else {
            winnerGroupPlayerId = null
            infoMessages.push('RET empate: ambos jugadores reciben 1 punto.')
            bumpKind('normalized')
          }
        } else if (winnerGroupPlayerId) {
          infoMessages.push('RET: ganador indicado por retiro, aunque el total de games este empatado.')
          bumpKind('normalized')
        } else if (valRet.games.a === valRet.games.b) {
          effectiveResultType = 'retired_draw'
          winnerGroupPlayerId = null
          infoMessages.push('RET con empate en games sin winner_id: ambos jugadores reciben 1 punto.')
          bumpKind('normalized')
        } else {
          const inferredWinner =
            valRet.winnerByGames === 'a' ? match.player_a_id : match.player_b_id
          if (winnerGroupPlayerId && winnerGroupPlayerId !== inferredWinner) {
            messages.push('RET: el winner_id debe ser el jugador con mayor cantidad total de games.')
          } else {
            winnerGroupPlayerId = inferredWinner
            infoMessages.push('RET: ganador inferido por mayor cantidad total de games.')
            bumpKind('normalized')
          }
        }
      }
    } else if (gameTypeParsed === 'sudden_death') {
      effectiveGameType = 'sudden_death'
      const setsSd: ScoreSet[] = []
      for (let i = 1; i <= 3; i += 1) {
        const s = pullSet(i)
        if (s) setsSd.push(s)
      }

      if (setsSd.length === 0) {
        if (
          historicalImportMode &&
          effectiveResultType === 'normal' &&
          winnerGroupPlayerId
        ) {
          scoreRaw = null
          infoMessages.push(
            'Muerte súbita sin sets en CSV · modo histórico: se guarda solo el ganador (marcador incompleto / legado).',
          )
          bumpKind('warning')
        } else {
          messages.push(
            'game_type sudden_death requiere set_1…set_3 para resultado normal (o modo histórico con winner_id y sin sets).',
          )
        }
      } else if (setsSd.length !== 1 && setsSd.length !== 3) {
        messages.push('Muerte subita: indica el set decisivo o 3 sets historicos.')
      } else {
        const rulesRow = rulesByTournamentId.get(tournamentId) ?? null
        const valSd = validateSuddenDeathMatchScore(setsSd, rulesRow, {
          historicalFlexibleSets: historicalImportMode,
        })
        if (!valSd.ok) messages.push(...valSd.errors)
        else {
          const forcedSd: 'a' | 'b' | undefined =
            winnerGroupPlayerId === match.player_a_id
              ? 'a'
              : winnerGroupPlayerId === match.player_b_id
                ? 'b'
                : undefined
          if (forcedSd && valSd.winner && forcedSd !== valSd.winner) {
            messages.push('El winner_id no coincide con el ganador del set decisivo (muerte subita).')
          } else {
            scoreRaw = setsSd
            if (
              !winnerGroupPlayerId &&
              effectiveResultType === 'normal' &&
              valSd.winner
            ) {
              winnerGroupPlayerId =
                valSd.winner === 'a' ? match.player_a_id : match.player_b_id
              infoMessages.push('Ganador inferido por set decisivo (muerte subita).')
              bumpKind('normalized')
            }
          }
        }
      }
    } else if (gameTypeParsed === 'long_set') {
      const s = pullSet(1)
      if (!s) {
        messages.push('long_set requiere set_1_a y set_1_b.')
      } else {
        const okFlex =
          Number.isInteger(s.a) && Number.isInteger(s.b) && s.a >= 0 && s.b >= 0
        if (!okFlex) messages.push('long_set: valores inválidos (enteros ≥ 0).')
        else {
          scoreRaw = [s]
          if (
            !winnerGroupPlayerId &&
            effectiveResultType === 'normal' &&
            s.a !== s.b
          ) {
            winnerGroupPlayerId = s.a > s.b ? match.player_a_id : match.player_b_id
            infoMessages.push('Ganador inferido por marcador (long_set).')
            bumpKind('normalized')
          }
        }
      }
    } else {
      const sets: ScoreSet[] = []
      for (let i = 1; i <= 3; i += 1) {
        const s = pullSet(i)
        if (s) sets.push(s)
      }

      if (sets.length === 0) {
        messages.push('best_of_3 requiere al menos un set con games (salvo W.O/DEF/RET sin marcador).')
      } else {
        const allowShort =
          historicalImportMode ||
          gameTypeParsed === 'best_of_3_short_tiebreak'

        const forcedWinnerSide: 'a' | 'b' | undefined =
          winnerGroupPlayerId === match.player_a_id
            ? 'a'
            : winnerGroupPlayerId === match.player_b_id
              ? 'b'
              : undefined

        const val = validateBestOf3Score(sets, {
          importCsvRelaxed: true,
          forcedWinnerSide,
          allowShortDecisiveSet: allowShort,
          shortDecisiveSetNoMinDifference: true,
        })

        if (!val.ok) messages.push(...val.errors)
        else {
          if (allowShort && sets.length === 3 && val.winner) {
            const w2 = sets.slice(0, 2).reduce(
              (acc, set) => {
                const side = set.a > set.b ? 'a' : 'b'
                acc[side] += 1
                return acc
              },
              { a: 0, b: 0 },
            )
            if (w2.a === 1 && w2.b === 1) {
              infoMessages.push('Tercer set corto (tie-break simplificado) aceptado.')
              bumpKind('normalized')
            }
          }

          scoreRaw = sets

          if (
            !winnerGroupPlayerId &&
            effectiveResultType === 'normal' &&
            val.winner
          ) {
            winnerGroupPlayerId =
              val.winner === 'a' ? match.player_a_id : match.player_b_id
            infoMessages.push('Ganador inferido por marcador.')
            bumpKind('normalized')
          }
        }
      }

      if (gameTypeParsed === 'best_of_3_short_tiebreak') {
        effectiveGameType = 'best_of_3_short_tiebreak'
      }
    }

    if (
      !openPendingWithoutScore &&
      !penaltyClosure &&
      effectiveStatus !== 'cancelled' &&
      !importResultTypeAllowsNullWinner(effectiveResultType) &&
      !winnerGroupPlayerId
    ) {
      messages.push(
        'Falta ganador explícito o el marcador no permite inferirlo. Indica winner_id o corrige los sets.',
      )
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
      infoMessages: infoMessages.length ? infoMessages : undefined,
      previewKind,
      resolved: {
        matchId: match.id,
        tournamentId,
        scoreRaw,
        gameType: effectiveGameType,
        resultType: effectiveResultType,
        status: effectiveStatus,
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

function isOpenPendingResolvedRow(r: NonNullable<MatchResultsImportPreviewRow['resolved']>): boolean {
  return r.status === 'pending_score' && !r.scoreRaw && !r.winnerGroupPlayerId
}

export type ApplyMatchResultsImportResult = {
  batchId: string
  success: number
  errors: number
  rowDetails: { rowNumber: number; ok: boolean; message?: string }[]
  /** Si es false, se usó el cliente fila a fila (p. ej. función Edge no desplegada). */
  appliedViaEdge?: boolean
}

/** Mensajes legibles para errores de Postgres / RPC en importación. */
export function humanizeMatchImportError(raw: string): string {
  const m = String(raw ?? '')
  if (m.includes('El ganador debe ser el jugador A o B')) {
    return 'El ganador no pertenece a este partido (debe ser jugador A o B del cruce).'
  }
  if (m.includes('Indica el ganador del partido')) {
    return 'Falta ganador para este tipo de resultado.'
  }
  if (m.includes('Solo staff')) {
    return 'No tienes permisos para aplicar este resultado.'
  }
  if (m.includes('Partido no encontrado')) {
    return 'El partido ya no existe en la base de datos.'
  }
  return m || 'No se pudo guardar el resultado.'
}

async function applyOneResolvedMatchRow(input: {
  uploadedBy: string
  resolved: NonNullable<MatchResultsImportPreviewRow['resolved']>
}): Promise<void> {
  const r = input.resolved
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
    return
  }

  if (isOpenPendingResolvedRow(r)) {
    const { error: upErr } = await supabase
      .from('matches')
      .update({
        status: 'pending_score',
        winner_id: null,
        score_raw: null,
        result_type: 'normal',
        game_type: r.gameType,
        updated_by: input.uploadedBy,
        updated_at: new Date().toISOString(),
        closed_at: null,
        admin_validated_at: null,
        admin_validated_by: null,
        score_submitted_by: null,
        score_submitted_at: null,
        opponent_confirmed_by: null,
        opponent_confirmed_at: null,
      })
      .eq('id', r.matchId)
    if (upErr) throw new Error(mapPgError(upErr))
    return
  }

  const needWinner = !importResultTypeAllowsNullWinner(r.resultType)
  if (needWinner && !r.winnerGroupPlayerId) throw new Error('Falta ganador.')

  const pScore = r.scoreRaw as Json | null
  const { error: rpcErr } = await supabase.rpc('admin_set_match_result', {
    p_match_id: r.matchId,
    p_score: pScore,
    p_winner_id: r.winnerGroupPlayerId,
    p_status: r.status,
    p_result_type: r.resultType,
    p_game_type: r.gameType,
  })
  if (rpcErr) throw new Error(mapPgError(rpcErr))
}

/**
 * Ejecuta filas listas por lotes vía Edge Function `admin-import-results` cuando está disponible;
 * si falla, aplica fila a fila con el cliente (mismo comportamiento que antes).
 */
export async function applyMatchResultsImport(input: {
  fileName: string | null
  uploadedBy: string
  rows: MatchResultsImportPreviewRow[]
  onChunkProgress?: (appliedReadyRows: number, totalReadyRows: number) => void
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
  const rowDetailsMap = new Map<number, { ok: boolean; message?: string }>()
  let hadSequentialFallback = false

  const readyRows = input.rows.filter((pr) => pr.state === 'ready' && pr.resolved)

  for (const pr of input.rows) {
    const payload = rowToAuditPayload(pr.cells) as Json
    if (pr.state === 'ready' && pr.resolved) continue

    errors += 1
    const msg = pr.messages.join(' | ') || 'Fila no lista'
    rowDetailsMap.set(pr.rowNumber, { ok: false, message: msg })
    await supabase.from('match_results_import_rows').insert({
      batch_id: batchId,
      row_number: pr.rowNumber,
      status: 'error',
      error_message: msg,
      match_id: null,
      payload,
    })
  }

  let useEdge = true
  let appliedReady = 0

  for (let ci = 0; ci < readyRows.length; ci += MATCH_RESULTS_EDGE_CHUNK_SIZE) {
    const chunk = readyRows.slice(ci, ci + MATCH_RESULTS_EDGE_CHUNK_SIZE)
    const edgePayload = chunk.map((pr) => {
      const r = pr.resolved!
      return {
        rowNumber: pr.rowNumber,
        matchId: r.matchId,
        cancelled: r.status === 'cancelled',
        scoreRaw: r.scoreRaw,
        winnerGroupPlayerId: r.winnerGroupPlayerId,
        status: r.status,
        resultType: r.resultType,
        gameType: r.gameType,
      }
    })

    let chunkOut: { rowNumber: number; ok: boolean; message?: string }[] | null = null

    if (useEdge) {
      try {
        chunkOut = await invokeAdminImportResults(edgePayload)
        if (chunkOut.length !== chunk.length) {
          chunkOut = null
          useEdge = false
          hadSequentialFallback = true
        }
      } catch {
        useEdge = false
        hadSequentialFallback = true
      }
    }

    if (!useEdge || chunkOut === null) {
      hadSequentialFallback = true
      chunkOut = []
      for (const pr of chunk) {
        try {
          await applyOneResolvedMatchRow({ uploadedBy: input.uploadedBy, resolved: pr.resolved! })
          chunkOut.push({ rowNumber: pr.rowNumber, ok: true })
        } catch (e) {
          const raw = e instanceof Error ? e.message : 'Error desconocido'
          chunkOut.push({ rowNumber: pr.rowNumber, ok: false, message: humanizeMatchImportError(raw) })
        }
      }
    }

    const resultByRow = new Map((chunkOut ?? []).map((x) => [x.rowNumber, x]))

    for (const pr of chunk) {
      const payload = rowToAuditPayload(pr.cells) as Json
      const r = pr.resolved!
      let res =
        resultByRow.get(pr.rowNumber) ??
        ({
          rowNumber: pr.rowNumber,
          ok: false,
          message: 'Respuesta incompleta del servidor de importación.',
        } as { rowNumber: number; ok: boolean; message?: string })
      if (!res.ok && isOpenPendingResolvedRow(r)) {
        try {
          await applyOneResolvedMatchRow({ uploadedBy: input.uploadedBy, resolved: r })
          hadSequentialFallback = true
          res = { rowNumber: pr.rowNumber, ok: true }
        } catch (e) {
          const raw = e instanceof Error ? e.message : 'Error desconocido'
          res = { rowNumber: pr.rowNumber, ok: false, message: humanizeMatchImportError(raw) }
        }
      }
      if (res.ok) {
        success += 1
        rowDetailsMap.set(pr.rowNumber, { ok: true })
        await supabase.from('match_results_import_rows').insert({
          batch_id: batchId,
          row_number: pr.rowNumber,
          status: 'success',
          error_message: null,
          match_id: r.matchId,
          payload,
        })
      } else {
        errors += 1
        rowDetailsMap.set(pr.rowNumber, { ok: false, message: res.message })
        await supabase.from('match_results_import_rows').insert({
          batch_id: batchId,
          row_number: pr.rowNumber,
          status: 'error',
          error_message: res.message ?? 'Error',
          match_id: r.matchId,
          payload,
        })
      }
    }

    appliedReady += chunk.length
    input.onChunkProgress?.(appliedReady, readyRows.length)
  }

  const rowDetails = input.rows.map((pr) => {
    const d = rowDetailsMap.get(pr.rowNumber)
    return {
      rowNumber: pr.rowNumber,
      ok: d?.ok ?? false,
      message: d?.message,
    }
  })

  await supabase
    .from('match_results_import_batches')
    .update({
      success_rows: success,
      error_rows: errors,
      status: 'completed',
    })
    .eq('id', batchId)

  return {
    batchId,
    success,
    errors,
    rowDetails,
    appliedViaEdge: readyRows.length === 0 ? undefined : !hadSequentialFallback,
  }
}
