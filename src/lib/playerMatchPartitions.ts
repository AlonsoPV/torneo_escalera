import { getPlayerMatches } from '@/lib/playerDashboard'
import { canAcceptScore, canSubmitScore } from '@/lib/matchStatus'
import type { MatchRow, TournamentRules } from '@/types/database'

/** Pendientes / En proceso / Historial para el panel del jugador. */
export function partitionPlayerMatches(
  matches: MatchRow[],
  membershipId: string,
  userId: string,
  rules: Pick<TournamentRules, 'allow_player_score_entry'>,
): {
  pendientes: MatchRow[]
  enProceso: MatchRow[]
  historial: MatchRow[]
} {
  const mine = getPlayerMatches(membershipId, matches)
  const allow = rules.allow_player_score_entry

  const needsMyAction = (m: MatchRow) =>
    Boolean(allow && (canSubmitScore(m, userId) || canAcceptScore(m, userId)))

  const pendientes = mine.filter(needsMyAction)
  const historial = mine.filter((m) => m.status === 'closed' || m.status === 'cancelled')
  const enProceso = mine.filter((m) => !needsMyAction(m) && m.status !== 'closed' && m.status !== 'cancelled')

  return { pendientes, enProceso, historial }
}
