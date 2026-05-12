import type { GroupCategory, TournamentMovementType } from '@/types/database'
import type { RankingRow } from '@/utils/ranking'

/** Intento según posición 1–5 antes de aplicar límites de categoría. */
export type PromotionIntent = 'promote' | 'stay' | 'demote'

/** Orden solo para ascenso/descenso: puntos → games a favor → diferencia de games → victorias → nombre. */
export function sortPlayersForPromotion(rows: RankingRow[]): RankingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.gamesFor !== a.gamesFor) return b.gamesFor - a.gamesFor
    const ad = a.gamesFor - a.gamesAgainst
    const bd = b.gamesFor - b.gamesAgainst
    if (bd !== ad) return bd - ad
    if (b.won !== a.won) return b.won - a.won
    return a.displayName.localeCompare(b.displayName)
  })
  return sorted.map((r, i) => ({ ...r, position: i + 1 }))
}

/**
 * Reglas 1–2 suben, 3 se mantiene, 4–5 bajan (solo aplica a posiciones existentes en el grupo).
 */
export function getMovementIntentByPosition(position: number): PromotionIntent {
  if (position <= 2) return 'promote'
  if (position === 3) return 'stay'
  return 'demote'
}

export function getTargetCategory(
  current: GroupCategory,
  intent: PromotionIntent,
  allCategories: GroupCategory[],
): { category: GroupCategory; movementType: TournamentMovementType } {
  const sorted = [...allCategories].sort((a, b) => a.order_index - b.order_index)
  const i = sorted.findIndex((c) => c.id === current.id)
  if (i < 0) {
    return { category: current, movementType: 'stay' }
  }

  if (intent === 'stay') {
    return { category: sorted[i]!, movementType: 'stay' }
  }

  if (intent === 'promote') {
    if (i === 0) {
      return { category: sorted[0]!, movementType: 'capped_top' }
    }
    return { category: sorted[i - 1]!, movementType: 'promote' }
  }

  if (intent === 'demote') {
    if (i >= sorted.length - 1) {
      return { category: sorted[i]!, movementType: 'capped_bottom' }
    }
    return { category: sorted[i + 1]!, movementType: 'demote' }
  }

  return { category: sorted[i]!, movementType: 'stay' }
}

export function chunkPlayersIntoGroups<T>(players: T[], size: number): T[][] {
  if (size < 1) throw new Error('El tamaño de grupo debe ser al menos 1')
  const chunks: T[][] = []
  for (let i = 0; i < players.length; i += size) {
    chunks.push(players.slice(i, i + size))
  }
  return chunks
}

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
