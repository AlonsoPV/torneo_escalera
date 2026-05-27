import type { GroupPlayer, MatchRow, MatchStatus, UserRole } from '@/types/database'

/**
 * Ciclo: jugador registra solo desde pendiente -> `closed`; rival refuta -> vuelve a `pending_score`;
 * administracion cierra -> `validated`. `score_disputed` queda como estado legacy/importacion.
 */
export const PLAYER_SCORE_STATUSES = [
  'pending_score',
  'score_submitted',
  'score_disputed',
  'player_confirmed',
  'closed',
  'validated',
  'cancelled',
] as const satisfies readonly MatchStatus[]

export const matchStatusLabels: Record<MatchStatus, string> = {
  pending_score: 'Pendiente de marcador',
  score_submitted: 'Confirmado · puede refutarse',
  score_disputed: 'Pendiente revisión administrativa',
  player_confirmed: 'Sin refutación · pendiente organizador',
  closed: 'Resultado oficial',
  validated: 'Validado por administración',
  cancelled: 'Cancelado',
}

export const matchStatusToneClasses: Record<MatchStatus, string> = {
  pending_score: 'border-blue-200 bg-blue-50 text-blue-700',
  score_submitted: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  score_disputed: 'border-amber-300 bg-amber-50 text-amber-950',
  player_confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  closed: 'border-green-200 bg-green-50 text-green-700',
  validated: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-500',
}

export function isMatchInRankingWindow(
  m: MatchRow,
): m is MatchRow & { winner_id: string } {
  if (!m.winner_id || m.status === 'cancelled') return false
  return m.status === 'closed' || m.status === 'validated'
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
  return isPendingScoreStatus(match.status)
}

export function canAcceptScore(_match: MatchRow, _userId: string | null | undefined): boolean {
  void _match
  void _userId
  return false
}

export function canRejectScore(match: MatchRow, userId: string | null | undefined): boolean {
  if (!userId) return false
  if (match.status !== 'closed') return false
  const participant = isMatchPlayerA(match, userId) || isMatchPlayerB(match, userId)
  if (!participant) return false
  if (match.score_submitted_by != null) {
    return match.score_submitted_by !== userId
  }
  return isMatchPlayerB(match, userId)
}

export function canAdminCloseScore(userRole: UserRole | null | undefined, match: MatchRow): boolean {
  const isAdmin = userRole === 'admin' || userRole === 'super_admin'
  if (
    !isAdmin ||
    match.status === 'closed' ||
    match.status === 'validated' ||
    match.status === 'cancelled'
  )
    return false
  return (
    match.status === 'player_confirmed' ||
    match.status === 'score_disputed' ||
    match.status === 'score_submitted'
  )
}

const ADMIN_CORRECTABLE_STATUSES: MatchStatus[] = [
  'pending_score',
  'score_submitted',
  'score_disputed',
  'player_confirmed',
  'closed',
  'validated',
]

export function canAdminCorrectScore(userRole: UserRole | null | undefined, match: MatchRow): boolean {
  const isAdmin = userRole === 'admin' || userRole === 'super_admin'
  return Boolean(isAdmin && ADMIN_CORRECTABLE_STATUSES.includes(match.status))
}

/**
 * Participante: captura cuando el partido esta pendiente; una refutacion vuelve a este estado.
 */
export function canPlayerACaptureScore(params: {
  match: MatchRow
  userId: string | null | undefined
  allowPlayerScoreEntry: boolean
}): boolean {
  const { match, userId, allowPlayerScoreEntry } = params
  return Boolean(allowPlayerScoreEntry && canSubmitScore(match, userId))
}

/** El otro participante (no quien envió): solo puede refutar cuando hay marcador confirmado para tabla. */
export function canPlayerBRespondToScore(params: {
  match: MatchRow
  userId: string | null | undefined
  allowPlayerScoreEntry: boolean
}): boolean {
  const { match, userId, allowPlayerScoreEntry } = params
  return Boolean(allowPlayerScoreEntry && canRejectScore(match, userId))
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
