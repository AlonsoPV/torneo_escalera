import type { GroupPlayer } from '@/types/database'

export type CanonicalPlayers = {
  playerA: GroupPlayer
  playerB: GroupPlayer
  playerAUserId: string
  playerBUserId: string
}

export function orderPlayersCanonically(
  p1: GroupPlayer,
  p2: GroupPlayer,
): CanonicalPlayers {
  if (p1.id === p2.id) {
    throw new Error('Un jugador no puede enfrentarse a sí mismo.')
  }
  const bySeed =
    p1.seed_order !== p2.seed_order
      ? p1.seed_order - p2.seed_order
      : p1.id.localeCompare(p2.id)
  if (bySeed < 0) {
    return {
      playerA: p1,
      playerB: p2,
      playerAUserId: p1.user_id,
      playerBUserId: p2.user_id,
    }
  }
  return {
    playerA: p2,
    playerB: p1,
    playerAUserId: p2.user_id,
    playerBUserId: p1.user_id,
  }
}

export function pairKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`
}
