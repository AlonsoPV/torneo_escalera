import {
  importResultTypeBothPenalized,
  importResultTypeUsesDefaultPoints,
} from '@/lib/matchResultSemantics'
import type { MatchRow, TournamentRules } from '@/types/database'

import { computeWinnerGroupPlayerId, getSuddenDeathWinnerSide } from '@/utils/score'
import { idsEqual } from '@/utils/tournamentInvert'

type MatchWinnerPick = Pick<
  MatchRow,
  'status' | 'winner_id' | 'player_a_id' | 'player_b_id' | 'score_raw' | 'game_type' | 'result_type'
>

const STATUSES_WITH_TABLE_WINNER: MatchWinnerPick['status'][] = ['closed', 'validated']

/**
 * Ganador para ranking / tableros: `closed` o `validated` con `winner_id` válido o inferible.
 */
export function getOfficialWinnerGroupPlayerId(
  match: MatchWinnerPick,
  rules: Pick<TournamentRules, 'best_of_sets'> | null | undefined,
): string | null {
  if (!STATUSES_WITH_TABLE_WINNER.includes(match.status)) return null
  if (importResultTypeBothPenalized(match.result_type)) return null

  if (match.winner_id) {
    if (idsEqual(match.winner_id, match.player_a_id) || idsEqual(match.winner_id, match.player_b_id)) {
      return match.winner_id
    }
    return null
  }

  if (importResultTypeUsesDefaultPoints(match.result_type)) {
    return null
  }

  if (match.game_type === 'sudden_death') {
    const raw = match.score_raw
    if (raw?.length === 3) {
      const side = getSuddenDeathWinnerSide(raw)
      if (!side) return null
      return side === 'a' ? match.player_a_id : match.player_b_id
    }
    return null
  }

  const sets = match.score_raw
  if (!sets?.length || !rules) return null

  return computeWinnerGroupPlayerId(sets, match.player_a_id, match.player_b_id, rules.best_of_sets)
}

/**
 * Versión para comparar en debug: solo inferencia por marcador (ignora `winner_id`).
 */
export function getWinnerFromScoreOnly(
  match: MatchWinnerPick,
  rules: Pick<TournamentRules, 'best_of_sets'> | null | undefined,
): string | null {
  if (match.game_type === 'sudden_death') {
    const raw = match.score_raw
    if (raw?.length === 3) {
      const side = getSuddenDeathWinnerSide(raw)
      if (!side) return null
      return side === 'a' ? match.player_a_id : match.player_b_id
    }
    return null
  }
  const sets = match.score_raw
  if (!sets?.length || !rules) return null
  return computeWinnerGroupPlayerId(sets, match.player_a_id, match.player_b_id, rules.best_of_sets)
}
