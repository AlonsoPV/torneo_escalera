import { getPlayerMatches } from '@/lib/playerDashboard'
import { canRejectScore, canSubmitScore } from '@/lib/matchStatus'
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

  /** Pendientes = captura jugador. Partidos cerrados/validados sin acción de refutar van a historial. */
  const needsCaptureOrResubmit = (m: MatchRow) => Boolean(allow && canSubmitScore(m, userId))

  const pendientes = mine.filter(needsCaptureOrResubmit)
  const historial = mine.filter(
    (m) =>
      m.status === 'cancelled' ||
      m.status === 'validated' ||
      (m.status === 'closed' && !(allow && canRejectScore(m, userId))),
  )
  const historialIds = new Set(historial.map((h) => h.id))
  const enProceso = mine.filter((m) => !needsCaptureOrResubmit(m) && !historialIds.has(m.id))

  return { pendientes, enProceso, historial }
}
