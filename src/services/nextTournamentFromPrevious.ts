import { supabase } from '@/lib/supabase'
import { getAdminGroups, type AdminGroupRecord } from '@/services/admin'
import { listGroupCategories } from '@/services/groupCategories'
import { buildRoundRobinMatchRows, type RoundRobinMatchInsertRow } from '@/services/matches'
import {
  createTournament,
  getTournament,
  getTournamentRules,
  updateTournamentRules,
  type TournamentRulesUpdatePayload,
} from '@/services/tournaments'
import type {
  GroupCategory,
  GroupPlayer,
  Tournament,
  TournamentMovementType,
  TournamentStatus,
} from '@/types/database'
import {
  chunkPlayersIntoGroups,
  comparePromotionPreviewPlayers,
  generateGroupName,
  getMovementIntentByPosition,
  getTargetCategory,
  sortPlayersForPromotion,
  type PromotionIntent,
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
  fromCategoryId: string
  fromCategoryName: string
  fromPosition: number
  points: number
  gamesFor: number
  gamesDifference: number
  intent: PromotionIntent
  /** Categoría destino en el torneo base (se mapea al id nuevo al crear el torneo). */
  targetSourceCategoryId: string
  targetCategoryName: string
  targetCategoryOrderIndex: number
  movementType: TournamentMovementType
}

export type NextTournamentGroupPreview = {
  targetSourceCategoryId: string
  categoryName: string
  orderIndex: number
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
  categoryName: string
  newCategoryId: string
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

async function copyGroupCategoryShell(
  fromTournamentId: string,
  toTournamentId: string,
): Promise<Map<string, string>> {
  const source = await listGroupCategories(fromTournamentId)
  if (source.length === 0) {
    throw new Error('El torneo base no tiene categorías de grupo. Configúralas antes de continuar.')
  }
  const sorted = [...source].sort((a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name))
  const insertRows = sorted.map((c) => ({
    tournament_id: toTournamentId,
    name: c.name,
    order_index: c.order_index,
  }))
  const { data, error } = await supabase.from('group_categories').insert(insertRows).select('id')
  if (error) throw error
  const returned = (data ?? []) as { id: string }[]
  if (returned.length !== sorted.length) {
    throw new Error('No se pudieron crear todas las categorías del nuevo torneo.')
  }
  const map = new Map<string, string>()
  sorted.forEach((c, i) => map.set(c.id, returned[i]!.id))
  return map
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

export async function buildPromotionPreview(baseTournamentId: string): Promise<{
  rows: PromotionPreviewRow[]
  categories: GroupCategory[]
  groupsWithoutCategory: number
  nonClosedMatchCount: number
  skippedDuplicatePlayers: number
}> {
  const [groups, rules, categories] = await Promise.all([
    getAdminGroups(baseTournamentId),
    getTournamentRules(baseTournamentId),
    listGroupCategories(baseTournamentId),
  ])

  if (!rules) {
    throw new Error('No hay reglas configuradas para el torneo base.')
  }

  const sortedCats = [...categories].sort((a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name))
  if (sortedCats.length === 0) {
    throw new Error('No hay categorías de grupo en el torneo base.')
  }

  const rows: PromotionPreviewRow[] = []
  const seenUser = new Set<string>()
  let groupsWithoutCategory = 0
  let skippedDuplicatePlayers = 0

  for (const g of groups) {
    if (!g.category) {
      if (g.players.length > 0) groupsWithoutCategory += 1
      continue
    }
    const ranking = sortPlayersForPromotion(
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
    for (const r of ranking) {
      const intent = getMovementIntentByPosition(r.position)
      const { category: targetCat, movementType } = getTargetCategory(g.category, intent, sortedCats)
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
        fromCategoryId: g.category.id,
        fromCategoryName: g.category.name,
        fromPosition: r.position,
        points: r.points,
        gamesFor: r.gamesFor,
        gamesDifference: r.gamesFor - r.gamesAgainst,
        intent,
        targetSourceCategoryId: targetCat.id,
        targetCategoryName: targetCat.name,
        targetCategoryOrderIndex: targetCat.order_index,
        movementType,
      })
    }
  }

  return {
    rows,
    categories: sortedCats,
    groupsWithoutCategory,
    nonClosedMatchCount: nonClosedMatchCount(groups),
    skippedDuplicatePlayers,
  }
}

export function buildNextTournamentGroupPreview(
  rows: PromotionPreviewRow[],
  groupSize: number,
): NextTournamentGroupPreview[] {
  const byCat = new Map<string, PromotionPreviewRow[]>()
  for (const row of rows) {
    const list = byCat.get(row.targetSourceCategoryId) ?? []
    list.push(row)
    byCat.set(row.targetSourceCategoryId, list)
  }

  const out: NextTournamentGroupPreview[] = []
  for (const [targetSourceCategoryId, bucket] of byCat) {
    const sorted = [...bucket].sort((a, b) => comparePromotionPreviewPlayers(a, b))
    const categoryName = sorted[0]?.targetCategoryName ?? 'Categoría'
    const orderIndex = sorted[0]?.targetCategoryOrderIndex ?? 0
    const chunks = chunkPlayersIntoGroups(sorted, groupSize)
    out.push({
      targetSourceCategoryId,
      categoryName,
      orderIndex,
      groups: chunks.map((chunk, idx) => ({
        name: generateGroupName(categoryName, idx),
        players: chunk.map((r) => ({ userId: r.userId, displayName: r.displayName })),
        isComplete: chunk.length === groupSize,
      })),
    })
  }

  out.sort((a, b) => a.orderIndex - b.orderIndex || a.categoryName.localeCompare(b.categoryName))
  return out
}

export function buildPlannedPersistGroups(
  groupPlan: NextTournamentGroupPreview[],
  categoryMap: Map<string, string>,
): PlannedPersistGroup[] {
  let order = 0
  const planned: PlannedPersistGroup[] = []
  for (const catPlan of groupPlan) {
    const newCategoryId = categoryMap.get(catPlan.targetSourceCategoryId)
    if (!newCategoryId) {
      throw new Error(`No se pudo mapear la categoría destino «${catPlan.categoryName}».`)
    }
    catPlan.groups.forEach((g, idx) => {
      planned.push({
        tempId: `${catPlan.targetSourceCategoryId}:${idx}:${g.name}`,
        name: g.name,
        categoryName: catPlan.categoryName,
        newCategoryId,
        orderIndex: order++,
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
        tempId: `${c.targetSourceCategoryId}:${idx}:${g.name}`,
        name: g.name,
        categoryName: c.categoryName,
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
      const dedupeKey = `${c.targetSourceCategoryId}|||${g.name.trim().toLowerCase()}`
      if (groupKeys.has(dedupeKey)) {
        errors.push(`Grupo duplicado en la misma categoría: «${g.name}» (${c.categoryName}).`)
      }
      groupKeys.add(dedupeKey)
    }
  }
  if (groupCount === 0) errors.push('No hay grupos generados en la vista previa.')

  if (base && groupPlan.length > 0) {
    const baseCats = await listGroupCategories(payload.baseTournamentId)
    const idSet = new Set(baseCats.map((c) => c.id))
    const missingOrder = baseCats.filter((c) => c.order_index == null || Number.isNaN(c.order_index))
    if (missingOrder.length) {
      errors.push('Todas las categorías del torneo base deben tener order_index definido.')
    }
    for (const c of groupPlan) {
      if (!idSet.has(c.targetSourceCategoryId)) {
        errors.push(`La categoría objetivo «${c.categoryName}» no existe en el torneo base.`)
      }
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
    const { rows: builtRows, groupsWithoutCategory } = await buildPromotionPreview(payload.baseTournamentId)
    if (builtRows.length === 0) {
      throw new Error(
        groupsWithoutCategory > 0
          ? 'No hay jugadores elegibles: asigna categorías a los grupos del torneo base.'
          : 'No hay jugadores en los grupos del torneo base.',
      )
    }
    rows = builtRows
    groupPlan = buildNextTournamentGroupPreview(rows, groupSize)
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

    const categoryMap = await copyGroupCategoryShell(payload.baseTournamentId, tournament.id)
    const planned = buildPlannedPersistGroups(groupPlan, categoryMap)
    const groupsTotal = planned.length
    const playersAssignTotal = planned.reduce((s, p) => s + p.players.length, 0)

    for (const p of planned) {
      cb.onGroupUpdate?.(p.tempId, 'saving_group', { playersTotal: p.players.length })
    }

    const groupInserts = planned.map((p) => ({
      tournament_id: tournament.id,
      name: p.name,
      order_index: p.orderIndex,
      group_category_id: p.newCategoryId,
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
    const movementRows = rows.map((r) => ({
      from_tournament_id: payload.baseTournamentId,
      to_tournament_id: tournament.id,
      player_id: r.userId,
      from_category_id: r.fromCategoryId,
      to_category_id: categoryMap.get(r.targetSourceCategoryId) ?? null,
      from_group_id: r.fromGroupId,
      from_position: r.fromPosition,
      points: r.points,
      games_for: r.gamesFor,
      games_difference: r.gamesDifference,
      movement_type: r.movementType,
      raw_movement: JSON.stringify({ intent: r.intent }),
    }))

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

/** Crea torneo siguiente, copia categorías (y reglas opcional), asigna jugadores y registra movimientos. */
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
