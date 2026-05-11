import type { MatchRow, ScoreSet } from '@/types/database'
import { formatScoreCompact, invertScoreSets } from '@/utils/score'

/**
 * Sets del marcador en perspectiva del perfil (userId), invirtiendo si el usuario es el jugador B.
 */
export function getPlayerPerspectiveScoreSetsForUserId(match: MatchRow, userId: string): ScoreSet[] | null {
  if (!match.score_raw?.length) return null
  if (match.player_a_user_id === userId) return match.score_raw
  if (match.player_b_user_id === userId) return invertScoreSets(match.score_raw)
  return null
}

/** Texto compacto del marcador desde la perspectiva del usuario. */
export function getPlayerPerspectiveScore(match: MatchRow, userId: string): string {
  if (match.game_type === 'sudden_death') {
    if (!match.winner_id) return 'Muerte súbita'
    const won =
      (match.player_a_user_id === userId && match.winner_id === match.player_a_id) ||
      (match.player_b_user_id === userId && match.winner_id === match.player_b_id)
    return won ? 'Ganó muerte súbita' : 'Perdió muerte súbita'
  }
  const sets = getPlayerPerspectiveScoreSetsForUserId(match, userId)
  if (!sets?.length) return '—'
  return formatScoreCompact(sets)
}
