import type { TournamentMovementReason, TournamentMovementType } from '@/types/database'
import { compareRankingRowsForLeaderboard, type RankingRow } from '@/utils/ranking'

/** Intento legado antes de límites; mantener solo si otros módulos lo referencian. */
export type PromotionIntent = 'promote' | 'stay' | 'demote'

export type GroupTierInput = {
  id?: string
  order_index: number
  name: string
  players: readonly unknown[]
}

export type BuildPromotionTierLadderOptions = {
  /** Solo grupos con clasificación / jugadores en el reparto (excluye grupos vacíos u huérfanos en BD). */
  participatingGroupIds?: ReadonlySet<string>
}

/** Un escalón de la cascada: nivel = número del nombre («GRUPO 15» → 15; MB → último). */
export type PromotionTierEntry = {
  groupId: string
  orderIndex: number
  name: string
  /** Nivel en la escalera (1 = GRUPO 1, 15 = GRUPO 15, 20 = MB en torneo de 20 grupos). */
  tierRank: number
}

function localeEsNumericNameCompare(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
}

/** Grupo MB siempre es el último escalón (no puede subir desde abajo ni actuar como grupo 1). */
export function isMbBottomTierGroupName(name: string): boolean {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ')
  return normalized === 'grupo mb' || normalized === 'mb'
}

/** Extrae el nivel del nombre visible: «GRUPO 15» → 15. MB u otros sin número → null. */
export function parseGroupNameTierNumber(name: string): number | null {
  if (isMbBottomTierGroupName(name)) return null
  const normalized = name.trim().replace(/\s+/g, ' ')
  const match = normalized.match(/^grupo\s*(\d+)\s*$/i)
  if (!match) return null
  const n = parseInt(match[1]!, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function compareGroupsForPromotionTier(a: GroupTierInput, b: GroupTierInput): number {
  const aMb = isMbBottomTierGroupName(a.name)
  const bMb = isMbBottomTierGroupName(b.name)
  if (aMb !== bMb) return aMb ? 1 : -1
  const aNum = parseGroupNameTierNumber(a.name)
  const bNum = parseGroupNameTierNumber(b.name)
  if (aNum != null && bNum != null && aNum !== bNum) return aNum - bNum
  if (a.order_index !== b.order_index) return a.order_index - b.order_index
  return localeEsNumericNameCompare(a.name, b.name)
}

function assignTierRanks(filtered: GroupTierInput[]): PromotionTierEntry[] {
  const numericMax = filtered.reduce((max, g) => {
    const n = parseGroupNameTierNumber(g.name)
    return n != null ? Math.max(max, n) : max
  }, 0)

  const entries: PromotionTierEntry[] = filtered.map((g) => {
    const parsed = parseGroupNameTierNumber(g.name)
    const tierRank = isMbBottomTierGroupName(g.name) ? numericMax + 1 : (parsed ?? numericMax + 2)
    return {
      groupId: g.id!,
      orderIndex: g.order_index,
      name: g.name,
      tierRank,
    }
  })

  return entries.sort((a, b) => a.tierRank - b.tierRank || localeEsNumericNameCompare(a.name, b.name))
}

/** Nivel máximo de la escalera (p. ej. 20 si hay GRUPO 19 + MB). */
export function getMaxPromotionTier(entries: PromotionTierEntry[]): number {
  if (entries.length === 0) return 0
  return Math.max(...entries.map((e) => e.tierRank))
}

/**
 * Escalera: nivel = número del nombre del grupo (GRUPO 1 → 1, GRUPO 15 → 15, MB → último).
 */
export function buildPromotionTierLadderEntries(
  groups: GroupTierInput[],
  opts?: BuildPromotionTierLadderOptions,
): PromotionTierEntry[] {
  const participating = opts?.participatingGroupIds
  const filtered = groups.filter(
    (g) => g.players.length > 0 && g.id && (!participating || participating.has(g.id)),
  )
  return assignTierRanks(filtered)
}

/**
 * `order_index` por nivel (persistencia del torneo destino).
 * @deprecated Preferir {@link buildPromotionTierLadderEntries} + {@link orderIndexForTierRank}.
 */
export function buildPromotionTierLadder(
  groups: GroupTierInput[],
  opts?: BuildPromotionTierLadderOptions,
): number[] {
  return buildPromotionTierLadderEntries(groups, opts).map((e) => e.orderIndex)
}

export function orderIndexForTierRank(entries: PromotionTierEntry[], tierRank: number): number {
  const exact = entries.find((e) => e.tierRank === tierRank)
  if (exact) return exact.orderIndex
  const sorted = [...entries].sort((a, b) => a.tierRank - b.tierRank)
  const next = sorted.find((e) => e.tierRank >= tierRank)
  return next?.orderIndex ?? sorted[sorted.length - 1]?.orderIndex ?? 0
}

/** Nivel del grupo según su nombre (GRUPO 15 → 15), no según `order_index`. */
export function getPromotionTierRankForGroup(entries: PromotionTierEntry[], groupId: string): number {
  return entries.find((e) => e.groupId === groupId)?.tierRank ?? 0
}

/** @deprecated Usar {@link getPromotionTierRankForGroup}; ambiguo si varios grupos comparten `order_index`. */
export function getPromotionTierRank(tierLadder: number[], orderIndex: number): number {
  const i = tierLadder.indexOf(orderIndex)
  return i >= 0 ? i + 1 : 0
}

/** Etiqueta de nivel para UI (evita confundir «Nivel 3» con el nombre «GRUPO 18»). */
export function promotionTierLabel(
  tierRankOneBased: number,
  groupName?: string,
  totalTiers?: number,
): string {
  if (tierRankOneBased < 1) return 'Nivel ?'
  const suffix = totalTiers != null && totalTiers > 0 ? ` de ${totalTiers}` : ''
  if (groupName && isMbBottomTierGroupName(groupName)) {
    return `Nivel ${tierRankOneBased}${suffix} (MB)`
  }
  return `Nivel ${tierRankOneBased}${suffix}`
}

/**
 * Orden para ascenso/descenso: puntos → games a favor → diferencia de games → nombre (estable).
 */
export function sortGroupStandingsForMovement(standings: RankingRow[]): RankingRow[] {
  const sorted = [...standings].sort(compareRankingRowsForLeaderboard)
  return sorted.map((r, i) => ({ ...r, position: i + 1 }))
}

/** @deprecated Usar {@link sortGroupStandingsForMovement}. */
export function sortPlayersForPromotion(rows: RankingRow[]): RankingRow[] {
  return sortGroupStandingsForMovement(rows)
}

/**
 * Escalera de grupos por **rango de nivel** (1 = mejor grupo).
 * Cascada: posiciones 1–2 suben un nivel, 3 se queda, 4–5 bajan un nivel (con topes arriba/abajo).
 */
export function getTargetGroupOrder(
  currentGroupOrder: number,
  position: number,
  minGroupOrder: number,
  maxGroupOrder: number,
): {
  targetGroupOrder: number
  movementType: TournamentMovementType
  movementReason: TournamentMovementReason
} {
  let idealTarget = currentGroupOrder
  if (position <= 2) idealTarget = currentGroupOrder - 1
  else if (position === 3) idealTarget = currentGroupOrder
  else idealTarget = currentGroupOrder + 1

  const targetGroupOrder = Math.max(minGroupOrder, Math.min(maxGroupOrder, idealTarget))

  if (position <= 2) {
    if (targetGroupOrder < currentGroupOrder) {
      return { targetGroupOrder, movementType: 'promote', movementReason: 'top_2_promote' }
    }
    return { targetGroupOrder, movementType: 'capped_top', movementReason: 'top_group_limit' }
  }

  if (position === 3) {
    return { targetGroupOrder, movementType: 'stay', movementReason: 'third_stays' }
  }

  if (targetGroupOrder > currentGroupOrder) {
    return { targetGroupOrder, movementType: 'demote', movementReason: 'bottom_2_demote' }
  }
  return { targetGroupOrder, movementType: 'capped_bottom', movementReason: 'bottom_group_limit' }
}

/**
 * `sortedDistinctOrderIndices`: valores `groups.order_index` distintos del torneo, orden ascendente
 * (menor índice = grupo más alto).
 * @deprecated Preferir {@link getTargetGroupOrder} con rangos de nivel.
 */
export function getTargetTierOrderIndex(
  currentGroupOrderIndex: number,
  intent: PromotionIntent,
  sortedDistinctOrderIndices: number[],
): { targetOrderIndex: number; movementType: TournamentMovementType } {
  const tiers = [...sortedDistinctOrderIndices]
  const i = tiers.indexOf(currentGroupOrderIndex)
  if (i < 0) {
    return { targetOrderIndex: currentGroupOrderIndex, movementType: 'stay' }
  }

  if (intent === 'stay') {
    return { targetOrderIndex: tiers[i]!, movementType: 'stay' }
  }

  if (intent === 'promote') {
    if (i === 0) {
      return { targetOrderIndex: tiers[0]!, movementType: 'capped_top' }
    }
    return { targetOrderIndex: tiers[i - 1]!, movementType: 'promote' }
  }

  if (intent === 'demote') {
    if (i >= tiers.length - 1) {
      return { targetOrderIndex: tiers[i]!, movementType: 'capped_bottom' }
    }
    return { targetOrderIndex: tiers[i + 1]!, movementType: 'demote' }
  }

  return { targetOrderIndex: tiers[i]!, movementType: 'stay' }
}

/** @deprecated Usar posiciones con {@link getTargetGroupOrder}. */
export function getMovementIntentByPosition(position: number): PromotionIntent {
  if (position <= 2) return 'promote'
  if (position === 3) return 'stay'
  return 'demote'
}

export function chunkPlayersIntoGroups<T>(players: T[], size: number): T[][] {
  if (size < 1) throw new Error('El tamaño de grupo debe ser al menos 1')
  const chunks: T[][] = []
  for (let i = 0; i < players.length; i += size) {
    chunks.push(players.slice(i, i + size))
  }
  return chunks
}

/** Nombre visible para sub-grupos cuando el mismo nivel tiene más de un grupo físico. */
export function generateTierGroupName(tierRankOneBased: number, indexWithinTierZeroBased: number, chunksInTier?: number): string {
  const n = chunksInTier ?? 1
  if (n <= 1) return promotionTierLabel(tierRankOneBased)
  return `${promotionTierLabel(tierRankOneBased)} · Sub ${indexWithinTierZeroBased + 1}`
}

/** Nombre inicial para grupos ligados a una categoría (admin). */
export function generateGroupName(categoryName: string, indexZeroBased: number): string {
  return `${categoryName} — Grupo ${indexZeroBased + 1}`
}

export function comparePromotionPreviewPlayers(
  a: { points: number; gamesFor: number; gamesDifference: number; displayName: string },
  b: { points: number; gamesFor: number; gamesDifference: number; displayName: string },
): number {
  if (b.points !== a.points) return b.points - a.points
  if (b.gamesFor !== a.gamesFor) return b.gamesFor - a.gamesFor
  if (b.gamesDifference !== a.gamesDifference) return b.gamesDifference - a.gamesDifference
  return a.displayName.localeCompare(b.displayName)
}

/**
 * Siembra en el grupo destino (0 = 1.er lugar, 4 = 5.º):
 * - Bajan (4.º/5.º) → 1.º y 2.º
 * - Suben (1.º/2.º) → 4.º y 5.º
 * - Se queda (3.º) → 3.º
 */
export function targetSeedOrderForPromotionRow(row: {
  fromPosition: number
  movementType: TournamentMovementType
}): number {
  const { fromPosition, movementType } = row

  if (movementType === 'demote') {
    if (fromPosition === 4) return 0
    if (fromPosition === 5) return 1
  }
  if (movementType === 'promote') {
    if (fromPosition === 1) return 3
    if (fromPosition === 2) return 4
  }
  if (movementType === 'stay') {
    if (fromPosition === 3) return 2
  }
  if (movementType === 'capped_top') {
    if (fromPosition === 1) return 0
    if (fromPosition === 2) return 1
  }
  if (movementType === 'capped_bottom') {
    if (fromPosition === 4) return 3
    if (fromPosition === 5) return 4
  }

  return Math.max(0, Math.min(4, fromPosition - 1))
}

export function comparePromotionRowsForGroupAssignment(
  a: { fromPosition: number; movementType: TournamentMovementType; points: number; gamesFor: number; gamesDifference: number; displayName: string },
  b: { fromPosition: number; movementType: TournamentMovementType; points: number; gamesFor: number; gamesDifference: number; displayName: string },
): number {
  const seedA = targetSeedOrderForPromotionRow(a)
  const seedB = targetSeedOrderForPromotionRow(b)
  if (seedA !== seedB) return seedA - seedB
  return comparePromotionPreviewPlayers(a, b)
}

type PromotionPreviewCascadeRow = {
  displayName: string
  fromGroupId: string
  fromGroupOrderIndex: number
  fromPosition: number
  targetOrderIndex: number
  movementType: TournamentMovementType
}

/** Valida que cada movimiento respete la cascada 1–2↑ / 3= / 4–5↓ sobre la escalera dada. */
export function validatePromotionPreviewCascade(
  previewRows: PromotionPreviewCascadeRow[],
  tierEntries: PromotionTierEntry[],
): string[] {
  if (tierEntries.length === 0) return ['No hay niveles de grupo para validar movimientos.']
  const errors: string[] = []
  const minTier = 1
  const maxTier = getMaxPromotionTier(tierEntries)

  for (const row of previewRows) {
    const fromTier = getPromotionTierRankForGroup(tierEntries, row.fromGroupId)
    if (fromTier < 1) {
      errors.push(`«${row.displayName}»: grupo origen no está en la escalera de promoción.`)
      continue
    }
    const expected = getTargetGroupOrder(fromTier, row.fromPosition, minTier, maxTier)
    const expectedOrderIndex = orderIndexForTierRank(tierEntries, expected.targetGroupOrder)
    if (row.targetOrderIndex !== expectedOrderIndex) {
      errors.push(
        `«${row.displayName}» (pos ${row.fromPosition} en nivel ${fromTier}): destino incorrecto; esperado nivel ${expected.targetGroupOrder}, obtuvo order_index ${row.targetOrderIndex}.`,
      )
    }
    if (row.movementType !== expected.movementType) {
      errors.push(
        `«${row.displayName}»: tipo de movimiento «${row.movementType}» no coincide con «${expected.movementType}».`,
      )
    }
  }
  return errors
}
