import type { MatchResultType, MatchRow, ScoreSet } from '@/types/database'

/** Marcador administrativo estándar para penalización mutua (importación histórica). */
export const IMPORT_ADMIN_PENALTY_SCORE: ScoreSet[] = [
  { a: 3, b: 6 },
  { a: 3, b: 6 },
]

/** Dos sets 6-3 a favor de A (perspectiva `player_a` en `matches.score_raw`). */
const ADMIN_SETS_WINNER_IS_A: ScoreSet[] = [
  { a: 6, b: 3 },
  { a: 6, b: 3 },
]

/** Dos sets 6-3 a favor de B. */
const ADMIN_SETS_WINNER_IS_B: ScoreSet[] = [
  { a: 3, b: 6 },
  { a: 3, b: 6 },
]

/**
 * Marcador administrativo para DEF / victoria por mesa sin games guardados:
 * ganador “gana” 6-3, 6-3 (el perdedor queda 3-6, 3-6).
 * No aplica a W.O. (suele ir sin games).
 */
export function syntheticAdministrativeSetsForDefaultMatch(
  m: Pick<MatchRow, 'player_a_id' | 'player_b_id' | 'winner_id' | 'score_raw' | 'result_type'>,
): ScoreSet[] | null {
  if (m.score_raw?.length) return null
  const rt = m.result_type
  if (rt === 'default_win_a') return ADMIN_SETS_WINNER_IS_A
  if (rt === 'default_win_b') return ADMIN_SETS_WINNER_IS_B
  if (rt === 'def') {
    const w = m.winner_id
    if (!w) return null
    if (w === m.player_a_id) return ADMIN_SETS_WINNER_IS_A
    if (w === m.player_b_id) return ADMIN_SETS_WINNER_IS_B
  }
  return null
}

export const IMPORT_PENALTY_RANKING_POINTS = -1

export function importResultTypeAllowsNullWinner(rt: MatchResultType | null | undefined): boolean {
  return rt === 'not_reported' || rt === 'double_penalty' || rt === 'pending_score'
}

export function importResultTypeBothPenalized(rt: MatchResultType | null | undefined): boolean {
  return importResultTypeAllowsNullWinner(rt)
}

export function importResultTypeUsesDefaultPoints(rt: MatchResultType | null | undefined): boolean {
  return rt === 'default_win_a' || rt === 'default_win_b' || rt === 'wo' || rt === 'def'
}

/** Omite validación estricta de games en importación CSV para estos tipos. */
export function importResultTypeRelaxesScoreValidation(rt: MatchResultType | null | undefined): boolean {
  return (
    importResultTypeAllowsNullWinner(rt) ||
    rt === 'wo' ||
    rt === 'def' ||
    rt === 'retired'
  )
}
