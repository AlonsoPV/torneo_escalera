import type { TournamentMovementReason, TournamentMovementType } from '@/types/database'
import type { RankingRow } from '@/utils/ranking'

/** Intento legado antes de límites; mantener solo si otros módulos lo referencian. */
export type PromotionIntent = 'promote' | 'stay' | 'demote'

/**
 * Orden para ascenso/descenso: puntos → games a favor → diferencia de games → nombre (estable).
 */
export function sortGroupStandingsForMovement(standings: RankingRow[]): RankingRow[] {
  const sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.gamesFor !== a.gamesFor) return b.gamesFor - a.gamesFor
    const ad = a.gamesFor - a.gamesAgainst
    const bd = b.gamesFor - b.gamesAgainst
    if (bd !== ad) return bd - ad
    return a.displayName.localeCompare(b.displayName)
  })
  return sorted.map((r, i) => ({ ...r, position: i + 1 }))
}

/** @deprecated Usar {@link sortGroupStandingsForMovement}. */
export function sortPlayersForPromotion(rows: RankingRow[]): RankingRow[] {
  return sortGroupStandingsForMovement(rows)
}

/**
 * Escalera de grupos por **rango de nivel** (1 = mejor grupo).
 * `currentGroupOrder`, `minGroupOrder`, `maxGroupOrder` son posiciones 1…N en la escalera,
 * no los valores arbitrarios de `groups.order_index` en base de datos.
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
  if (n <= 1) return `Grupo ${tierRankOneBased}`
  return `Grupo ${tierRankOneBased} · Sub ${indexWithinTierZeroBased + 1}`
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
