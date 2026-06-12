import type { GroupStandingRow, SimPlayer } from '@/types/tournament'

/** Orden del cuadro: posición en tabla (1…n), luego seed, luego id. */
export function sortPlayersByStandingPosition(
  players: SimPlayer[],
  standings: GroupStandingRow[],
): SimPlayer[] {
  const standingByPlayer = new Map(standings.map((s) => [s.playerId, s]))

  return [...players].sort((a, b) => {
    const stA = standingByPlayer.get(a.id)
    const stB = standingByPlayer.get(b.id)
    const posA = stA?.position ?? Number.MAX_SAFE_INTEGER
    const posB = stB?.position ?? Number.MAX_SAFE_INTEGER
    if (posA !== posB) return posA - posB
    const seedA = stA?.seed_order ?? a.seed_order
    const seedB = stB?.seed_order ?? b.seed_order
    return seedA - seedB || a.id.localeCompare(b.id)
  })
}

/** Número de fila/columna (#) coherente con la posición en la tabla. */
export function matrixPositionLabel(
  playerId: string,
  sortedIndex: number,
  standings: GroupStandingRow[],
): number {
  const position = standings.find((s) => s.playerId === playerId)?.position
  return position ?? sortedIndex + 1
}
