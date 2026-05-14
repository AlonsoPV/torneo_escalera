import { supabase } from '@/lib/supabase'
import { getAdminGroups, type AdminGroupRecord } from '@/services/admin'
import { buildRoundRobinMatchRows, type RoundRobinMatchInsertRow } from '@/services/matches'
import {
  createTournament,
  getTournament,
  getTournamentRules,
  updateTournamentRules,
  type TournamentRulesUpdatePayload,
} from '@/services/tournaments'
import type {
  GroupPlayer,
  Tournament,
  TournamentMovementReason,
  TournamentMovementType,
  TournamentStatus,
} from '@/types/database'
import {
  chunkPlayersIntoGroups,
  comparePromotionPreviewPlayers,
  generateTierGroupName,
  getTargetGroupOrder,
  sortGroupStandingsForMovement,
} from '@/utils/nextTournamentPromotion'
import { computeGroupRanking } from '@/utils/ranking'

/** Tamaño de lote para inserts masivos (PostgREST / límites prácticos). */
const INSERT_CHUNK_DEFAULT = 500

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return []
  const s = Math.max(1, size)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += s) {
    out.push(items.slice(i, i + s))
  }
  return out
}

async function insertRowsInChunks<T extends Record<string, unknown>>(
  table: 'matches' | 'group_players' | 'tournament_movements',
  rows: T[],
  chunkSize = INSERT_CHUNK_DEFAULT,
): Promise<void> {
  if (rows.length === 0) return
  for (const chunk of chunkArray(rows, chunkSize)) {
    const { error } = await supabase.from(table).insert(chunk as never)
    if (error) throw error
  }
}

async function insertGroupPlayersBatched(
  rows: {
    group_id: string
    user_id: string
    display_name: string | null
    seed_order: number | null
  }[],
  chunkSize = INSERT_CHUNK_DEFAULT,
): Promise<GroupPlayer[]> {
  if (rows.length === 0) return []
  const all: GroupPlayer[] = []
  for (const chunk of chunkArray(rows, chunkSize)) {
    const { data, error } = await supabase.from('group_players').insert(chunk).select('*')
    if (error) throw error
    all.push(...((data ?? []) as GroupPlayer[]))
  }
  return all
}

export type PromotionPreviewRow = {
  userId: string
  displayName: string
  fromGroupId: string
  fromGroupName: string
  /** `groups.order_index` del grupo origen (menor = nivel más alto). */
  fromGroupOrderIndex: number
  fromPosition: number
  points: number
  gamesFor: number
  gamesDifference: number
  /** `order_index` objetivo en los nuevos grupos del siguiente torneo. */
  targetOrderIndex: number
  /** Etiqueta «Grupo N» según la jerarquía destino. */
  targetGroupLabel: string
  movementType: TournamentMovementType
  movementReason: TournamentMovementReason
}

export type NextTournamentGroupPreview = {
  targetOrderIndex: number
  tierDisplayName: string
  groups: {
    name: string
    players: { userId: string; displayName: string }[]
    isComplete: boolean
  }[]
}

export type CreateNextTournamentPayload = {
  baseTournamentId: string
  name: string
  periodLabel?: string | null
  description?: string | null
  category?: string | null
  season?: string | null
  status?: TournamentStatus
  copyRules: boolean
  createdBy: string
  /** Cupo por grupo (por defecto 5 = round robin automático al completar). */
  groupSize?: number
  /** Si el wizard ya calculó vista previa, evita recalcular y otra lectura a grupos. */
  cachedPreview?: {
    rows: PromotionPreviewRow[]
    groupPlan: NextTournamentGroupPreview[]
  }
}

export type CreateNextTournamentResult = {
  tournament: Tournament
  groupsCreated: number
  playersAssigned: number
  fullGroupsWithMatches: number
  incompleteGroups: number
  movementsRecorded: number
}

/** Pasos principales del wizard de creación (UI). */
export type NextTournamentCreationStepKey =
  | 'creating_tournament'
  | 'copying_rules'
  | 'saving_groups'
  | 'assigning_players'
  | 'generating_matches'
  | 'saving_movements'
  | 'finished'

/** Estado por grupo durante el guardado (UI + callbacks). */
export type GroupPersistStatus =
  | 'pending'
  | 'saving_group'
  | 'group_saved'
  | 'assigning_players'
  | 'players_assigned'
  | 'generating_matches'
  | 'matches_generated'
  | 'incomplete'
  | 'error'

export type GroupProgressCallbackMeta = {
  playersAssigned?: number
  playersTotal?: number
  matchesInserted?: number
  matchesEstimated?: number
  message?: string
  groupId?: string
}

export type NextTournamentProgressSnapshot = {
  /** 0–100 */
  fraction: number
  label: string
  groupsSaved: number
  groupsTotal: number
  playersAssigned: number
  playersTotal: number
  matchesGenerated: number
}

export type CreateNextTournamentProgressCallbacks = {
  onStepStart?: (step: NextTournamentCreationStepKey) => void
  onStepSuccess?: (step: NextTournamentCreationStepKey) => void
  onStepError?: (step: NextTournamentCreationStepKey, error: Error) => void
  onGroupUpdate?: (groupTempId: string, status: GroupPersistStatus, meta?: GroupProgressCallbackMeta) => void
  onProgressUpdate?: (p: NextTournamentProgressSnapshot) => void
}

export type PlannedPersistGroup = {
  tempId: string
  name: string
  tierDisplayName: string
  targetOrderIndex: number
  orderIndex: number
  players: { userId: string; displayName: string }[]
  isComplete: boolean
}

export type CreateNextTournamentWithProgressResult = CreateNextTournamentResult & {
  matchesInserted: number
  partialFailure: boolean
  groupErrors: Array<{ tempId: string; name: string; message: string }>
  movementSaveError?: string | null
}

function rulesRowToUpdatePayload(
  row: NonNullable<Awaited<ReturnType<typeof getTournamentRules>>>,
): TournamentRulesUpdatePayload {
  return {
    best_of_sets: row.best_of_sets,
    set_points: row.set_points,
    tiebreak_enabled: row.tiebreak_enabled,
    super_tiebreak_final_set: row.super_tiebreak_final_set,
    points_per_win: row.points_per_win,
    points_per_loss: row.points_per_loss,
    points_default_win: row.points_default_win,
    points_default_loss: row.points_default_loss,
    tiebreak_criteria: row.tiebreak_criteria,
    allow_player_score_entry: row.allow_player_score_entry,
    updated_by: null,
    defaults_enabled: row.defaults_enabled,
    default_requires_admin_review: row.default_requires_admin_review,
    player_can_report_default: row.player_can_report_default,
    admin_can_set_default_manual: row.admin_can_set_default_manual,
    result_submission_window_hours: row.result_submission_window_hours,
    auto_penalty_no_show: row.auto_penalty_no_show,
    allow_7_6: row.allow_7_6,
    allow_7_5: row.allow_7_5,
    ranking_criteria: row.ranking_criteria,
    match_format: row.match_format,
    set_type: row.set_type,
    games_per_set: row.games_per_set,
    min_game_difference: row.min_game_difference,
    tiebreak_at: row.tiebreak_at,
    final_set_format: row.final_set_format,
    sudden_death_points: row.sudden_death_points,
  }
}

async function copyTournamentRulesFromTo(fromTournamentId: string, toTournamentId: string): Promise<void> {
  const from = await getTournamentRules(fromTournamentId)
  if (!from) throw new Error('No se encontraron reglas en el torneo origen.')
  await updateTournamentRules(toTournamentId, rulesRowToUpdatePayload(from))
}

function nonClosedMatchCount(groups: AdminGroupRecord[]): number {
  let n = 0
  for (const g of groups) {
    for (const m of g.matches) {
      if (m.status !== 'closed' && m.status !== 'cancelled') n += 1
    }
  }
  return n
}

function distinctSortedGroupOrderIndices(groups: AdminGroupRecord[]): number[] {
  const set = new Set<number>()
  for (const g of groups) {
    if (g.players.length > 0) set.add(g.order_index)
  }
  return [...set].sort((a, b) => a - b)
}

function groupLabelForTierRank(sortedDistinct: number[], targetOrderIndex: number): string {
  const i = sortedDistinct.indexOf(targetOrderIndex)
  const tr = i >= 0 ? i + 1 : 1
  return `Grupo ${tr}`
}

export async function buildPromotionPreview(baseTournamentId: string): Promise<{
  rows: PromotionPreviewRow[]
  sortedDistinctGroupOrderIndices: number[]
  nonClosedMatchCount: number
  skippedDuplicatePlayers: number
  baseTournamentStatus: TournamentStatus | null
  snapshotRowCount: number
  usedSnapshot: boolean
}> {
  const [groups, rules, baseTournament, snapRes] = await Promise.all([
    getAdminGroups(baseTournamentId),
    getTournamentRules(baseTournamentId),
    getTournament(baseTournamentId),
    supabase.from('tournament_final_standings').select('*').eq('tournament_id', baseTournamentId),
  ])

  if (snapRes.error) throw snapRes.error

  if (!rules) {
    throw new Error('No hay reglas configuradas para el torneo base.')
  }

  const sortedDistinct = distinctSortedGroupOrderIndices(groups)
  if (sortedDistinct.length === 0) {
    throw new Error('No hay grupos con jugadores en el torneo base.')
  }

  const snapRows = snapRes.data ?? []
  const usedSnapshot = snapRows.length > 0
  const minTier = 1
  const maxTier = sortedDistinct.length

  const rows: PromotionPreviewRow[] = []
  const seenUser = new Set<string>()
  let skippedDuplicatePlayers = 0

  if (usedSnapshot) {
    const playerIds = [...new Set(snapRows.map((r) => r.player_id))]
    const profileMap = new Map<string, string>()
    if (playerIds.length > 0) {
      const { data: profs, error: pErr } = await supabase.from('profiles').select('id, full_name').in('id', playerIds)
      if (pErr) throw pErr
      for (const p of profs ?? []) {
        profileMap.set(p.id, p.full_name ?? 'Sin nombre')
      }
    }

    const byGroup = new Map<string, typeof snapRows>()
    for (const row of snapRows) {
      const list = byGroup.get(row.group_id) ?? []
      list.push(row)
      byGroup.set(row.group_id, list)
    }

    for (const [, plist] of byGroup) {
      const gid = plist[0]?.group_id
      const g = gid ? groups.find((x) => x.id === gid) : undefined
      if (!g || g.players.length === 0) continue

      const ordered = [...plist].sort((a, b) => a.position - b.position || a.player_id.localeCompare(b.player_id))
      const tierRank = sortedDistinct.indexOf(g.order_index) + 1
      if (tierRank < 1) continue

      for (const row of ordered) {
        const displayName =
          profileMap.get(row.player_id) ??
          g.players.find((p) => p.user_id === row.player_id)?.display_name ??
          'Sin nombre'
        const { targetGroupOrder: targetTierRank, movementType, movementReason } = getTargetGroupOrder(
          tierRank,
          row.position,
          minTier,
          maxTier,
        )
        const targetOrderIndex = sortedDistinct[targetTierRank - 1]!
        if (seenUser.has(row.player_id)) {
          skippedDuplicatePlayers += 1
          continue
        }
        seenUser.add(row.player_id)
        rows.push({
          userId: row.player_id,
          displayName,
          fromGroupId: g.id,
          fromGroupName: g.name,
          fromGroupOrderIndex: g.order_index,
          fromPosition: row.position,
          points: row.points,
          gamesFor: row.games_for,
          gamesDifference: row.games_difference,
          targetOrderIndex,
          targetGroupLabel: groupLabelForTierRank(sortedDistinct, targetOrderIndex),
          movementType,
          movementReason,
        })
      }
    }
  } else {
    for (const g of groups) {
      if (g.players.length === 0) continue

      const ranking = sortGroupStandingsForMovement(
        computeGroupRanking(
          g.players.map(({ id, user_id, group_id, display_name, seed_order, created_at }) => ({
            id,
            user_id,
            group_id,
            display_name,
            seed_order,
            created_at,
          })),
          g.matches,
          rules,
        ),
      )
      const tierRank = sortedDistinct.indexOf(g.order_index) + 1
      if (tierRank < 1) continue

      for (const r of ranking) {
        const { targetGroupOrder: targetTierRank, movementType, movementReason } = getTargetGroupOrder(
          tierRank,
          r.position,
          minTier,
          maxTier,
        )
        const targetOrderIndex = sortedDistinct[targetTierRank - 1]!
        const gp = g.players.find((p) => p.user_id === r.userId)
        const displayName = gp?.display_name ?? r.displayName
        if (seenUser.has(r.userId)) {
          skippedDuplicatePlayers += 1
          continue
        }
        seenUser.add(r.userId)
        rows.push({
          userId: r.userId,
          displayName,
          fromGroupId: g.id,
          fromGroupName: g.name,
          fromGroupOrderIndex: g.order_index,
          fromPosition: r.position,
          points: r.points,
          gamesFor: r.gamesFor,
          gamesDifference: r.gamesFor - r.gamesAgainst,
          targetOrderIndex,
          targetGroupLabel: groupLabelForTierRank(sortedDistinct, targetOrderIndex),
          movementType,
          movementReason,
        })
      }
    }
  }

  return {
    rows,
    sortedDistinctGroupOrderIndices: sortedDistinct,
    nonClosedMatchCount: nonClosedMatchCount(groups),
    skippedDuplicatePlayers,
    baseTournamentStatus: baseTournament?.status ?? null,
    snapshotRowCount: snapRows.length,
    usedSnapshot,
  }
}

export function buildNextTournamentGroupPreview(
  rows: PromotionPreviewRow[],
  groupSize: number,
  sortedDistinctGroupOrderIndices: number[],
): NextTournamentGroupPreview[] {
  const tierRank = (orderIdx: number) => {
    const i = sortedDistinctGroupOrderIndices.indexOf(orderIdx)
    return i >= 0 ? i + 1 : 1
  }

  const byTier = new Map<number, PromotionPreviewRow[]>()
  for (const row of rows) {
    const list = byTier.get(row.targetOrderIndex) ?? []
    list.push(row)
    byTier.set(row.targetOrderIndex, list)
  }

  const out: NextTournamentGroupPreview[] = []
  const tierKeys = [...byTier.keys()].sort((a, b) => a - b)

  for (const targetOrderIndex of tierKeys) {
    const bucket = byTier.get(targetOrderIndex)!
    const sorted = [...bucket].sort((a, b) => comparePromotionPreviewPlayers(a, b))
    const tr = tierRank(targetOrderIndex)
    const tierDisplayName = `Grupo ${tr}`
    const chunks = chunkPlayersIntoGroups(sorted, groupSize)
    out.push({
      targetOrderIndex,
      tierDisplayName,
      groups: chunks.map((chunk, idx) => ({
        name: generateTierGroupName(tr, idx, chunks.length),
        players: chunk.map((r) => ({ userId: r.userId, displayName: r.displayName })),
        isComplete: chunk.length === groupSize,
      })),
    })
  }

  return out
}

export function buildPlannedPersistGroups(groupPlan: NextTournamentGroupPreview[]): PlannedPersistGroup[] {
  const tierKeysSorted = [...new Set(groupPlan.map((c) => c.targetOrderIndex))].sort((a, b) => a - b)
  const planned: PlannedPersistGroup[] = []
  for (const tierPlan of groupPlan) {
    const tierRank = tierKeysSorted.indexOf(tierPlan.targetOrderIndex) + 1
    tierPlan.groups.forEach((g, idx) => {
      planned.push({
        tempId: `${tierPlan.targetOrderIndex}:${idx}:${g.name}`,
        name: g.name,
        tierDisplayName: tierPlan.tierDisplayName,
        targetOrderIndex: tierPlan.targetOrderIndex,
        orderIndex: tierRank * 100 + idx,
        players: g.players,
        isComplete: g.isComplete,
      })
    })
  }
  return planned
}

export type GroupProgressTrackSeed = {
  tempId: string
  name: string
  categoryName: string
  status: GroupPersistStatus
  playersTotal: number
  isComplete: boolean
}

/** Filas iniciales para la UI de progreso (mismos `tempId` que el guardado). */
export function buildGroupProgressSkeleton(groupPlan: NextTournamentGroupPreview[]): GroupProgressTrackSeed[] {
  const rows: GroupProgressTrackSeed[] = []
  for (const c of groupPlan) {
    c.groups.forEach((g, idx) => {
      rows.push({
        tempId: `${c.targetOrderIndex}:${idx}:${g.name}`,
        name: g.name,
        categoryName: c.tierDisplayName,
        status: 'pending',
        playersTotal: g.players.length,
        isComplete: g.isComplete,
      })
    })
  }
  return rows
}

export function computeNextTournamentCreationSummary(
  groupPlan: NextTournamentGroupPreview[],
  movementCount: number,
  groupSize: number,
): {
  totalGroups: number
  completeGroups: number
  incompleteGroups: number
  totalPlayers: number
  estimatedMatches: number
  movementCount: number
} {
  let totalGroups = 0
  let completeGroups = 0
  let incompleteGroups = 0
  let totalPlayers = 0
  let estimatedMatches = 0
  const rrPerFull = groupSize >= 2 ? (groupSize * (groupSize - 1)) / 2 : 0
  for (const c of groupPlan) {
    for (const g of c.groups) {
      totalGroups++
      totalPlayers += g.players.length
      if (g.isComplete) {
        completeGroups++
        estimatedMatches += rrPerFull
      } else {
        incompleteGroups++
      }
    }
  }
  return {
    totalGroups,
    completeGroups,
    incompleteGroups,
    totalPlayers,
    estimatedMatches,
    movementCount,
  }
}

export function computeNextTournamentGroupSizeWarnings(
  groupPlan: NextTournamentGroupPreview[],
  groupSize: number,
): string[] {
  const warnings: string[] = []
  for (const tier of groupPlan) {
    for (const g of tier.groups) {
      const n = g.players.length
      if (n > groupSize) {
        warnings.push(
          `«${g.name}» tiene ${n} jugadores (supera el tamaño ideal de ${groupSize}). Revisa el reparto o ajusta manualmente en Grupos.`,
        )
      }
      if (n > 0 && n < groupSize) {
        warnings.push(`«${g.name}» quedó incompleto (${n}/${groupSize}); no se generará round robin automático.`)
      }
    }
  }
  return warnings
}

/**
 * Validación antes de persistir. Si devuelve no vacío, no iniciar guardado.
 */
export async function validateNextTournamentCreationPlan(
  payload: CreateNextTournamentPayload,
  previewRows: PromotionPreviewRow[],
  groupPlan: NextTournamentGroupPreview[],
): Promise<string[]> {
  const errors: string[] = []
  const name = payload.name?.trim() ?? ''
  if (!name) errors.push('Indica un nombre para el torneo.')
  if (!payload.baseTournamentId) errors.push('Falta el torneo base.')
  if (!payload.createdBy) errors.push('Sesión no válida.')
  const base = await getTournament(payload.baseTournamentId)
  if (!base) errors.push('El torneo base no existe o no tienes acceso.')

  if (previewRows.length === 0) {
    errors.push('No hay jugadores que repartir en la vista previa.')
  }

  const seenUsers = new Set<string>()
  for (const r of previewRows) {
    if (seenUsers.has(r.userId)) {
      errors.push(`Jugador duplicado en el nuevo torneo: ${r.displayName}`)
    }
    seenUsers.add(r.userId)
  }

  const groupKeys = new Set<string>()
  let groupCount = 0
  for (const c of groupPlan) {
    for (const g of c.groups) {
      groupCount++
      if (!g.name?.trim()) errors.push('Hay un grupo sin nombre en la vista previa.')
      const dedupeKey = `${c.targetOrderIndex}|||${g.name.trim().toLowerCase()}`
      if (groupKeys.has(dedupeKey)) {
        errors.push(`Grupo duplicado en el mismo nivel: «${g.name}» (${c.tierDisplayName}).`)
      }
      groupKeys.add(dedupeKey)
    }
  }
  if (groupCount === 0) errors.push('No hay grupos generados en la vista previa.')

  if (base) {
    if (base.status !== 'finished') {
      errors.push('El torneo base debe estar finalizado (estado «finished») antes de crear el siguiente.')
    }
    if (base.status === 'finished' && base.finished_at) {
      const { count, error } = await supabase
        .from('tournament_final_standings')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', payload.baseTournamentId)
      if (error) throw error
      if ((count ?? 0) === 0) {
        errors.push(
          'El torneo base no tiene snapshot de clasificación final. Cierra el torneo de nuevo desde Administración → Torneos.',
        )
      }
    }
    const groups = await getAdminGroups(payload.baseTournamentId)
    if (nonClosedMatchCount(groups) > 0) {
      errors.push('Todos los partidos del torneo base deben estar cerrados o cancelados.')
    }
  }

  return errors
}

function stepFraction(step: NextTournamentCreationStepKey, stepPhase: 'start' | 'done'): number {
  const order: NextTournamentCreationStepKey[] = [
    'creating_tournament',
    'copying_rules',
    'saving_groups',
    'assigning_players',
    'generating_matches',
    'saving_movements',
    'finished',
  ]
  const idx = order.indexOf(step)
  const n = order.length
  if (step === 'finished' && stepPhase === 'done') return 100
  const base = Math.max(0, idx) / n
  const bump = stepPhase === 'done' ? 1 / n : 0
  return Math.min(99, Math.round((base + bump) * 100))
}

export async function createNextTournamentWithProgress(
  payload: CreateNextTournamentPayload,
  callbacks: CreateNextTournamentProgressCallbacks = {},
): Promise<CreateNextTournamentWithProgressResult> {
  const cb = callbacks
  const groupSize = payload.groupSize ?? 5
  const devLog = (...args: unknown[]) => {
    if (import.meta.env.DEV) console.log(...args)
  }

  const emitProgress = (partial: Partial<NextTournamentProgressSnapshot> & Pick<NextTournamentProgressSnapshot, 'label'>) => {
    cb.onProgressUpdate?.({
      fraction: partial.fraction ?? 0,
      label: partial.label,
      groupsSaved: partial.groupsSaved ?? 0,
      groupsTotal: partial.groupsTotal ?? 0,
      playersAssigned: partial.playersAssigned ?? 0,
      playersTotal: partial.playersTotal ?? 0,
      matchesGenerated: partial.matchesGenerated ?? 0,
    })
  }

  let rows: PromotionPreviewRow[]
  let groupPlan: NextTournamentGroupPreview[]

  if (payload.cachedPreview) {
    rows = payload.cachedPreview.rows
    groupPlan = payload.cachedPreview.groupPlan
  } else {
    const preview = await buildPromotionPreview(payload.baseTournamentId)
    if (preview.rows.length === 0) {
      throw new Error('No hay jugadores elegibles en los grupos del torneo base.')
    }
    rows = preview.rows
    groupPlan = buildNextTournamentGroupPreview(rows, groupSize, preview.sortedDistinctGroupOrderIndices)
  }

  const groupsPreviewCount = groupPlan.reduce((a, c) => a + c.groups.length, 0)
  const playersPreviewCount = rows.length

  devLog('Creating next tournament', { ...payload, cachedPreview: payload.cachedPreview ? '[inline]' : undefined })
  devLog('Groups to persist (preview count)', groupsPreviewCount)

  const base = await getTournament(payload.baseTournamentId)
  if (!base) throw new Error('Torneo base no encontrado.')

  let currentStep: NextTournamentCreationStepKey = 'creating_tournament'
  const groupErrors: Array<{ tempId: string; name: string; message: string }> = []
  let matchesInsertedTotal = 0
  let movementSaveError: string | null = null

  try {
    currentStep = 'creating_tournament'
    cb.onStepStart?.(currentStep)
    emitProgress({ fraction: stepFraction(currentStep, 'start'), label: 'Creando torneo…', groupsTotal: groupsPreviewCount, playersTotal: playersPreviewCount })

    const { tournament } = await createTournament({
      name: payload.name,
      description: payload.description ?? undefined,
      category: payload.category ?? undefined,
      season: payload.season ?? undefined,
      status: payload.status ?? 'draft',
      createdBy: payload.createdBy,
      previousTournamentId: payload.baseTournamentId,
      periodLabel: payload.periodLabel ?? undefined,
      initialGroups: 'none',
    })
    cb.onStepSuccess?.(currentStep)
    emitProgress({ fraction: stepFraction(currentStep, 'done'), label: 'Torneo creado', groupsTotal: groupsPreviewCount, playersTotal: playersPreviewCount })

    currentStep = 'copying_rules'
    cb.onStepStart?.(currentStep)
    if (payload.copyRules) {
      emitProgress({ fraction: stepFraction(currentStep, 'start'), label: 'Copiando reglas…', groupsTotal: groupsPreviewCount, playersTotal: playersPreviewCount })
      await copyTournamentRulesFromTo(payload.baseTournamentId, tournament.id)
    }
    cb.onStepSuccess?.(currentStep)
    emitProgress({ fraction: stepFraction(currentStep, 'done'), label: payload.copyRules ? 'Reglas copiadas' : 'Reglas omitidas', groupsTotal: groupsPreviewCount, playersTotal: playersPreviewCount })

    currentStep = 'saving_groups'
    cb.onStepStart?.(currentStep)
    emitProgress({ fraction: stepFraction(currentStep, 'start'), label: `Guardando ${groupsPreviewCount} grupos…`, groupsTotal: groupsPreviewCount, playersTotal: playersPreviewCount })

    const planned = buildPlannedPersistGroups(groupPlan)
    const groupsTotal = planned.length
    const playersAssignTotal = planned.reduce((s, p) => s + p.players.length, 0)

    for (const p of planned) {
      cb.onGroupUpdate?.(p.tempId, 'saving_group', { playersTotal: p.players.length })
    }

    const groupInserts = planned.map((p) => ({
      tournament_id: tournament.id,
      name: p.name,
      order_index: p.orderIndex,
      group_category_id: null,
      max_players: groupSize,
    }))

    const { data: createdGroups, error: gErr } = await supabase.from('groups').insert(groupInserts).select('*')
    if (gErr) throw gErr
    if (!createdGroups || createdGroups.length !== planned.length) {
      throw new Error('No se pudieron crear todos los grupos en la base de datos.')
    }

    devLog('Groups saved', createdGroups.map((g) => ({ id: g.id, name: g.name })))

    planned.forEach((p, i) => {
      const row = createdGroups[i] as { id: string }
      cb.onGroupUpdate?.(p.tempId, 'group_saved', { groupId: row.id, playersTotal: p.players.length })
    })

    cb.onStepSuccess?.(currentStep)
    emitProgress({
      fraction: stepFraction(currentStep, 'done'),
      label: `${groupsTotal} grupos guardados`,
      groupsSaved: groupsTotal,
      groupsTotal,
      playersTotal: playersAssignTotal,
    })

    currentStep = 'assigning_players'
    cb.onStepStart?.(currentStep)
    emitProgress({
      fraction: stepFraction(currentStep, 'start'),
      label: `Asignando ${playersAssignTotal} jugadores…`,
      groupsSaved: groupsTotal,
      groupsTotal,
      playersTotal: playersAssignTotal,
    })
    for (const p of planned) {
      cb.onGroupUpdate?.(p.tempId, 'assigning_players', { playersTotal: p.players.length })
    }

    const gpRows: {
      group_id: string
      user_id: string
      display_name: string | null
      seed_order: number | null
    }[] = []
    planned.forEach((p, i) => {
      const gid = (createdGroups[i] as { id: string }).id
      p.players.forEach((pl, seed) => {
        gpRows.push({
          group_id: gid,
          user_id: pl.userId,
          display_name: pl.displayName,
          seed_order: seed,
        })
      })
    })

    const gpData = await insertGroupPlayersBatched(gpRows)

    devLog('Players assigned', gpRows.length)

    const byGroupId = new Map<string, GroupPlayer[]>()
    for (const row of (gpData ?? []) as GroupPlayer[]) {
      const gid = row.group_id
      const list = byGroupId.get(gid) ?? []
      list.push(row)
      byGroupId.set(gid, list)
    }

    planned.forEach((p, i) => {
      const gid = (createdGroups[i] as { id: string }).id
      const n = byGroupId.get(gid)?.length ?? 0
      cb.onGroupUpdate?.(p.tempId, 'players_assigned', {
        playersAssigned: n,
        playersTotal: p.players.length,
      })
    })

    cb.onStepSuccess?.(currentStep)
    emitProgress({
      fraction: stepFraction(currentStep, 'done'),
      label: `${playersAssignTotal} jugadores asignados`,
      groupsSaved: groupsTotal,
      groupsTotal,
      playersAssigned: playersAssignTotal,
      playersTotal: playersAssignTotal,
    })

    currentStep = 'generating_matches'
    cb.onStepStart?.(currentStep)
    const completeIndices: number[] = []
    planned.forEach((_, i) => {
      const gid = (createdGroups[i] as { id: string }).id
      const players = byGroupId.get(gid) ?? []
      if (players.length === groupSize) completeIndices.push(i)
    })

    const perGroupMatchCount = (groupSize * (groupSize - 1)) / 2
    const matchesExpectedTotal = completeIndices.length * perGroupMatchCount

    emitProgress({
      fraction: stepFraction(currentStep, 'start'),
      label:
        matchesExpectedTotal > 0
          ? `Generando ${matchesExpectedTotal} partidos…`
          : 'Sin grupos completos para partidos',
      groupsSaved: groupsTotal,
      groupsTotal,
      playersAssigned: playersAssignTotal,
      playersTotal: playersAssignTotal,
      matchesGenerated: 0,
    })

    const builtGroups: { tempId: string; name: string; rows: RoundRobinMatchInsertRow[] }[] = []
    for (const i of completeIndices) {
      const p = planned[i]!
      const gid = (createdGroups[i] as { id: string }).id
      const players = byGroupId.get(gid) ?? []
      try {
        const rowBatch = buildRoundRobinMatchRows({
          tournamentId: tournament.id,
          groupId: gid,
          players,
          createdBy: payload.createdBy,
        })
        builtGroups.push({ tempId: p.tempId, name: p.name, rows: rowBatch })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al generar partidos'
        groupErrors.push({ tempId: p.tempId, name: p.name, message })
        cb.onGroupUpdate?.(p.tempId, 'error', { message })
      }
    }

    const matchesPayload = builtGroups.flatMap((b) => b.rows)
    await insertRowsInChunks('matches', matchesPayload)

    matchesInsertedTotal = matchesPayload.length

    for (const b of builtGroups) {
      cb.onGroupUpdate?.(b.tempId, 'matches_generated', {
        matchesInserted: b.rows.length,
        matchesEstimated: perGroupMatchCount,
        playersAssigned: groupSize,
        playersTotal: groupSize,
      })
    }

    for (let i = 0; i < planned.length; i++) {
      const p = planned[i]!
      const gid = (createdGroups[i] as { id: string }).id
      const players = byGroupId.get(gid) ?? []
      if (players.length < groupSize) {
        cb.onGroupUpdate?.(p.tempId, 'incomplete', {
          playersAssigned: players.length,
          playersTotal: groupSize,
        })
      }
    }

    cb.onStepSuccess?.(currentStep)
    emitProgress({
      fraction: stepFraction(currentStep, 'done'),
      label:
        matchesInsertedTotal > 0
          ? `${matchesInsertedTotal} partidos guardados`
          : 'Partidos omitidos (sin grupos completos)',
      groupsSaved: groupsTotal,
      groupsTotal,
      playersAssigned: playersAssignTotal,
      playersTotal: playersAssignTotal,
      matchesGenerated: matchesInsertedTotal,
    })

    devLog('Matches generated (total rows)', matchesInsertedTotal)

    currentStep = 'saving_movements'
    cb.onStepStart?.(currentStep)
    emitProgress({
      fraction: stepFraction(currentStep, 'start'),
      label: `Guardando ${rows.length} movimientos…`,
      groupsSaved: groupsTotal,
      groupsTotal,
      playersAssigned: playersAssignTotal,
      playersTotal: playersAssignTotal,
      matchesGenerated: matchesInsertedTotal,
    })
    const userToMeta = new Map<string, { toGroupId: string; toOrderIndex: number }>()
    planned.forEach((p, i) => {
      const gid = (createdGroups[i] as { id: string }).id
      for (const pl of p.players) {
        userToMeta.set(pl.userId, { toGroupId: gid, toOrderIndex: p.targetOrderIndex })
      }
    })

    const movementRows = rows.map((r) => {
      const meta = userToMeta.get(r.userId)
      return {
        from_tournament_id: payload.baseTournamentId,
        to_tournament_id: tournament.id,
        player_id: r.userId,
        from_category_id: null,
        to_category_id: null,
        from_group_id: r.fromGroupId,
        to_group_id: meta?.toGroupId ?? null,
        from_group_order_index: r.fromGroupOrderIndex,
        to_group_order_index: meta?.toOrderIndex ?? null,
        from_position: r.fromPosition,
        points: r.points,
        games_for: r.gamesFor,
        games_difference: r.gamesDifference,
        movement_type: r.movementType,
        movement_reason: r.movementReason,
        raw_movement: JSON.stringify({
          movementReason: r.movementReason,
          targetOrderIndex: r.targetOrderIndex,
          fromGroupOrderIndex: r.fromGroupOrderIndex,
        }),
      }
    })

    try {
      await insertRowsInChunks('tournament_movements', movementRows)
    } catch (movCatch) {
      movementSaveError = movCatch instanceof Error ? movCatch.message : String(movCatch)
      groupErrors.push({
        tempId: '_movements',
        name: 'Movimientos del torneo',
        message: movementSaveError,
      })
      cb.onStepError?.(currentStep, new Error(movementSaveError))
    }

    if (!movementSaveError) {
      cb.onStepSuccess?.(currentStep)
    }

    devLog('Movements saved', movementSaveError ? 0 : movementRows.length)
    currentStep = 'finished'
    cb.onStepStart?.(currentStep)
    cb.onStepSuccess?.(currentStep)
    emitProgress({
      fraction: 100,
      label: 'Finalizado',
      groupsSaved: groupsTotal,
      groupsTotal,
      playersAssigned: playersAssignTotal,
      playersTotal: playersAssignTotal,
      matchesGenerated: matchesInsertedTotal,
    })

    const fullGroupsWithMatches = planned.filter((p) => p.players.length === groupSize).length
    const incompleteGroups = planned.filter((p) => p.players.length < groupSize).length

    const partialFailure = groupErrors.length > 0 || Boolean(movementSaveError)

    return {
      tournament,
      groupsCreated: planned.length,
      playersAssigned: playersAssignTotal,
      fullGroupsWithMatches,
      incompleteGroups,
      movementsRecorded: movementSaveError == null ? movementRows.length : 0,
      matchesInserted: matchesInsertedTotal,
      partialFailure,
      groupErrors,
      movementSaveError,
    }
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err))
    cb.onStepError?.(currentStep, e)
    throw e
  }
}

/** Crea el torneo siguiente según niveles de grupo del torneo base (reglas opcional), asigna jugadores y registra movimientos. */
export async function createNextTournamentFromPrevious(
  payload: CreateNextTournamentPayload,
): Promise<CreateNextTournamentResult> {
  const r = await createNextTournamentWithProgress(payload, {})
  return {
    tournament: r.tournament,
    groupsCreated: r.groupsCreated,
    playersAssigned: r.playersAssigned,
    fullGroupsWithMatches: r.fullGroupsWithMatches,
    incompleteGroups: r.incompleteGroups,
    movementsRecorded: r.movementsRecorded,
  }
}
