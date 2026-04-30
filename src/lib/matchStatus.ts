import type { GroupPlayer, MatchRow } from '@/types/database'

export { getPlayerPerspectiveScoreSets as getPlayerPerspectiveScore } from '@/lib/playerDashboard'

export function isMatchInRankingWindow(
  m: MatchRow,
): m is MatchRow & { winner_id: string } {
  if (!m.winner_id || m.status === 'cancelled') return false
  return m.status === 'closed'
}

/** Sin hora de fin agendada = ventana abierta (alineado con RPC). */
export function isMatchReadyForTimeWindow(m: MatchRow, now: Date = new Date()): boolean {
  if (!m.scheduled_end_at) return true
  return new Date(m.scheduled_end_at) < now
}

export function isMatchPlayerA(match: MatchRow, userId: string | null | undefined): boolean {
  return Boolean(userId && match.player_a_user_id === userId)
}

export function isMatchPlayerB(match: MatchRow, userId: string | null | undefined): boolean {
  return Boolean(userId && match.player_b_user_id === userId)
}

/**
 * Jugador A: captura o corrige solo en scheduled / ready_for_score / score_disputed
 * (no tras enviar a revisión del rival).
 */
export function canPlayerACaptureScore(params: {
  match: MatchRow
  userId: string | null | undefined
  allowPlayerScoreEntry: boolean
}): boolean {
  const { match, userId, allowPlayerScoreEntry } = params
  if (!allowPlayerScoreEntry || !isMatchPlayerA(match, userId)) return false
  if (match.status === 'cancelled') return false
  if (!['scheduled', 'ready_for_score', 'score_disputed'].includes(match.status)) return false
  if (!isMatchReadyForTimeWindow(match)) return false
  return true
}

/** Jugador B: aceptar o rechazar cuando el marcador está pendiente de revisión. */
export function canPlayerBRespondToScore(params: {
  match: MatchRow
  userId: string | null | undefined
  allowPlayerScoreEntry: boolean
}): boolean {
  const { match, userId, allowPlayerScoreEntry } = params
  if (!allowPlayerScoreEntry || !isMatchPlayerB(match, userId)) return false
  return match.status === 'score_submitted'
}

/** Compat: “puede editar marcador” = A en ventana de captura, o admin (manejado aparte). */
export function canPlayerSubmitResult(params: {
  match: MatchRow
  isParticipant: boolean
  allowPlayerScoreEntry: boolean
  userId?: string | null
}): boolean {
  const { match, isParticipant, allowPlayerScoreEntry, userId } = params
  if (!isParticipant || !allowPlayerScoreEntry) return false
  if (userId != null && canPlayerACaptureScore({ match, userId, allowPlayerScoreEntry })) return true
  return false
}

export function canAdminEditMatch(_match: MatchRow, isAdmin: boolean): boolean {
  return isAdmin
}

export function matchDisplayStatus(m: MatchRow): string {
  if ((m.status === 'scheduled' || m.status === 'ready_for_score') && isMatchReadyForTimeWindow(m) && m.winner_id == null) {
    return 'ready_for_score'
  }
  if (m.status === 'ready_for_score') {
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
