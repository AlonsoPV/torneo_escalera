import type { GroupPlayer, MatchRow, MatchStatus, ScoreSet, UserRole } from '@/types/database'
import { invertScoreSets } from '@/utils/score'

/**
 * Ciclo acordado: cualquier participante envía → score_submitted (`score_submitted_by`);
 * el otro acepta → player_confirmed; staff cierra → closed.
 * Rechazo → score_disputed (cualquiera de los dos puede corregir y reenviar).
 */
export const PLAYER_SCORE_STATUSES = [
  'pending_score',
  'score_submitted',
  'score_disputed',
  'player_confirmed',
  'closed',
  'cancelled',
] as const satisfies readonly MatchStatus[]

export const matchStatusLabels: Record<MatchStatus, string> = {
  pending_score: 'Pendiente de marcador',
  score_submitted: 'Marcador enviado',
  score_disputed: 'En disputa',
  player_confirmed: 'Aceptado por rival',
  closed: 'Resultado oficial',
  cancelled: 'Cancelado',
}

export const matchStatusToneClasses: Record<MatchStatus, string> = {
  pending_score: 'border-blue-200 bg-blue-50 text-blue-700',
  score_submitted: 'border-amber-200 bg-amber-50 text-amber-800',
  score_disputed: 'border-red-200 bg-red-50 text-red-700',
  player_confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  closed: 'border-green-200 bg-green-50 text-green-700',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-500',
}

export function isMatchInRankingWindow(
  m: MatchRow,
): m is MatchRow & { winner_id: string } {
  if (!m.winner_id || m.status === 'cancelled') return false
  return m.status === 'closed'
}

/** MVP sin agenda: cualquier partido pendiente puede capturarse libremente. */
export function isMatchReadyForTimeWindow(m: MatchRow, now: Date = new Date()): boolean {
  void m
  void now
  return true
}

export function isPendingScoreStatus(status: MatchStatus): boolean {
  return status === 'pending_score'
}

export function isMatchPlayerA(match: MatchRow, userId: string | null | undefined): boolean {
  return Boolean(userId && match.player_a_user_id === userId)
}

export function isMatchPlayerB(match: MatchRow, userId: string | null | undefined): boolean {
  return Boolean(userId && match.player_b_user_id === userId)
}

export function canSubmitScore(match: MatchRow, userId: string | null | undefined): boolean {
  if (!userId) return false
  const participant = isMatchPlayerA(match, userId) || isMatchPlayerB(match, userId)
  if (!participant) return false
  return isPendingScoreStatus(match.status) || match.status === 'score_disputed'
}

export function canAcceptScore(match: MatchRow, userId: string | null | undefined): boolean {
  if (!userId || match.status !== 'score_submitted') return false
  const participant = isMatchPlayerA(match, userId) || isMatchPlayerB(match, userId)
  if (!participant) return false
  if (match.score_submitted_by != null) {
    return match.score_submitted_by !== userId
  }
  return isMatchPlayerB(match, userId)
}

export function canRejectScore(match: MatchRow, userId: string | null | undefined): boolean {
  return canAcceptScore(match, userId)
}

export function canAdminCloseScore(userRole: UserRole | null | undefined, match: MatchRow): boolean {
  const isAdmin = userRole === 'admin' || userRole === 'super_admin'
  if (!isAdmin || match.status === 'closed' || match.status === 'cancelled') return false
  return match.status === 'player_confirmed' || match.status === 'score_disputed'
}

export function canAdminCorrectScore(userRole: UserRole | null | undefined, match: MatchRow): boolean {
  const isAdmin = userRole === 'admin' || userRole === 'super_admin'
  return Boolean(isAdmin && match.status !== 'closed' && match.status !== 'cancelled')
}

export function getPlayerPerspectiveScore(match: MatchRow, userId: string | null | undefined): ScoreSet[] {
  const score = match.score_raw ?? []
  if (!userId || score.length === 0) return []
  if (isMatchPlayerA(match, userId)) return score
  if (isMatchPlayerB(match, userId)) return invertScoreSets(score)
  return []
}

/**
 * Participante: captura o corrige en pendiente de marcador o disputa
 * (no tras enviar a revisión del rival).
 */
export function canPlayerACaptureScore(params: {
  match: MatchRow
  userId: string | null | undefined
  allowPlayerScoreEntry: boolean
}): boolean {
  const { match, userId, allowPlayerScoreEntry } = params
  return Boolean(allowPlayerScoreEntry && canSubmitScore(match, userId))
}

/** El otro participante (no quien envió): aceptar o rechazar cuando hay marcador pendiente de revisión. */
export function canPlayerBRespondToScore(params: {
  match: MatchRow
  userId: string | null | undefined
  allowPlayerScoreEntry: boolean
}): boolean {
  const { match, userId, allowPlayerScoreEntry } = params
  return Boolean(allowPlayerScoreEntry && canAcceptScore(match, userId))
}

/** “puede editar marcador” = participante en ventana de captura, o admin (manejado aparte). */
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
  if (isPendingScoreStatus(m.status) && m.winner_id == null) return 'pending_score'
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
