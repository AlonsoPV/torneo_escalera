import type { GroupPlayer, MatchRow } from '@/types/database'

export { getPlayerPerspectiveScoreSets as getPlayerPerspectiveScore } from '@/lib/playerDashboard'

export function isMatchInRankingWindow(
  m: MatchRow,
): m is MatchRow & { winner_id: string } {
  if (!m.winner_id || m.status === 'cancelled') return false
  return (
    m.status === 'result_submitted' ||
    m.status === 'confirmed' ||
    m.status === 'corrected'
  )
}

/** Sin hora de fin agendada = ventana abierta (alineado con RPC submit_player_match_result). */
export function isMatchReadyForTimeWindow(m: MatchRow, now: Date = new Date()): boolean {
  if (!m.scheduled_end_at) return true
  return new Date(m.scheduled_end_at) < now
}

/**
 * Puede marcar o **corregir** mientras el staff no haya confirmado: primer envío
 * o reenvío en `result_submitted`, siempre con ventana de tiempo y reglas.
 */
export function canPlayerSubmitResult(params: {
  match: MatchRow
  isParticipant: boolean
  allowPlayerScoreEntry: boolean
}): boolean {
  const { match, isParticipant, allowPlayerScoreEntry } = params
  if (!isParticipant || !allowPlayerScoreEntry) return false
  if (match.status === 'confirmed' || match.status === 'corrected' || match.status === 'cancelled') {
    return false
  }
  if (match.status === 'result_submitted') {
    return isMatchReadyForTimeWindow(match)
  }
  if (match.status !== 'pending' && match.status !== 'scheduled' && match.status !== 'ready_for_result') {
    return false
  }
  if (!isMatchReadyForTimeWindow(match)) return false
  return true
}

export function canAdminEditMatch(_match: MatchRow, isAdmin: boolean): boolean {
  if (!isAdmin) return false
  return true
}

export function matchDisplayStatus(m: MatchRow): string {
  if (m.status === 'scheduled' || m.status === 'pending') {
    if (isMatchReadyForTimeWindow(m) && m.winner_id == null) {
      return 'ready_for_result'
    }
  }
  if (m.status === 'ready_for_result') {
    if (!isMatchReadyForTimeWindow(m) && m.winner_id == null) return m.status
  }
  return m.status
}

function playersByIdMap(players: GroupPlayer[]) {
  return new Map(players.map((p) => [p.id, p] as const))
}

export function getOpponentInMatch(
  m: MatchRow,
  myGroupPlayerId: string,
  players: GroupPlayer[],
) {
  const byId = playersByIdMap(players)
  const otherId = m.player_a_id === myGroupPlayerId ? m.player_b_id : m.player_a_id
  return byId.get(otherId)
}
