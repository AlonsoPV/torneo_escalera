import type { ScoreSet } from '@/types/tournament'

/** Compara IDs de jugador (UUID u otros) sin depender de mayúsculas/minúsculas. */
export function idsEqual(a: string, b: string): boolean {
  return a === b || a.toLowerCase() === b.toLowerCase()
}

/** Invierte la perspectiva del marcador (solo UI; la fuente de verdad sigue en perspectiva canónica A/B). */
export function invertScore(sets: ScoreSet[]): ScoreSet[] {
  return sets.map((s) => ({ a: s.b, b: s.a }))
}

/**
 * Marcador para la celda (fila = jugador de la fila, columna = rival):
 * el primer número de cada set es siempre el de la fila, el segundo el del rival.
 * La fuente canónica almacena `score` como jugador A vs jugador B.
 */
export function perspectiveScoreSetsForRowPlayer(
  rowPlayerId: string,
  match: { playerAId: string; playerBId: string; score?: ScoreSet[] },
): ScoreSet[] {
  const sets = match.score ?? []
  const rowIsA = idsEqual(rowPlayerId, match.playerAId)
  return rowIsA ? sets : invertScore(sets)
}
