import type { GroupPlayer, MatchRow, ScoreSet, TournamentRules } from '@/types/database'
import type { RankingRow } from '@/utils/ranking'
import { perspectiveSetsForCell } from '@/utils/ranking'
import { formatScoreCompact } from '@/utils/score'

export function isMatchCompleted(m: MatchRow): boolean {
  if (!m.winner_id || m.status === 'cancelled') return false
  if (m.result_type && m.result_type !== 'normal') return true
  return Boolean(m.score_raw && m.score_raw.length > 0)
}

export function isMatchPending(m: MatchRow): boolean {
  if (m.status === 'cancelled') return false
  return m.winner_id == null
}

export function getPlayerMatches(membershipId: string, matches: MatchRow[]): MatchRow[] {
  return matches.filter((m) => m.player_a_id === membershipId || m.player_b_id === membershipId)
}

export function getUpcomingMatches(membershipId: string, matches: MatchRow[]): MatchRow[] {
  return getPlayerMatches(membershipId, matches).filter(isMatchPending)
}

export function getCompletedMatches(membershipId: string, matches: MatchRow[]): MatchRow[] {
  return getPlayerMatches(membershipId, matches).filter(isMatchCompleted)
}

/**
 * Sets del partido en perspectiva del group_player indicado (como en la matriz: fila = jugador).
 */
export function getPlayerPerspectiveScoreSets(
  match: MatchRow,
  myGroupPlayerId: string,
): ScoreSet[] | null {
  return perspectiveSetsForCell(myGroupPlayerId, myGroupPlayerId, match)
}

export function getPlayerPerspectiveScoreLabel(
  match: MatchRow,
  myGroupPlayerId: string,
): string {
  const sets = getPlayerPerspectiveScoreSets(match, myGroupPlayerId)
  if (!sets || sets.length === 0) return '—'
  return formatScoreCompact(sets)
}

export function getOpponentGroupPlayerId(match: MatchRow, myGroupPlayerId: string): string | null {
  if (match.player_a_id === myGroupPlayerId) return match.player_b_id
  if (match.player_b_id === myGroupPlayerId) return match.player_a_id
  return null
}

export function getOpponentName(
  match: MatchRow,
  myGroupPlayerId: string,
  playersById: Map<string, GroupPlayer>,
): string {
  const oid = getOpponentGroupPlayerId(match, myGroupPlayerId)
  if (!oid) return '—'
  return playersById.get(oid)?.display_name ?? 'Rival'
}

export function getPointsForPlayerInMatch(
  match: MatchRow,
  myGroupPlayerId: string,
  rules: Pick<
    TournamentRules,
    'points_per_win' | 'points_per_loss' | 'points_default_win' | 'points_default_loss'
  >,
): number {
  if (!match.winner_id) return 0
  if (match.result_type && match.result_type !== 'normal') {
    if (match.winner_id === myGroupPlayerId) return rules.points_default_win
    return rules.points_default_loss
  }
  if (match.winner_id === myGroupPlayerId) return rules.points_per_win
  return rules.points_per_loss
}

export type Outcome = 'win' | 'loss'

export function getMatchOutcome(
  match: MatchRow,
  myGroupPlayerId: string,
): Outcome | null {
  if (!match.winner_id) return null
  if (match.winner_id === myGroupPlayerId) return 'win'
  return 'loss'
}

export function getPlayerStanding(
  userId: string,
  rows: RankingRow[],
): RankingRow | undefined {
  return rows.find((r) => r.userId === userId)
}

export function roundRobinMatchesPerPlayer(playerCount: number): number {
  if (playerCount < 2) return 0
  return playerCount - 1
}

export function sortMatchesByDateDesc(matches: MatchRow[]): MatchRow[] {
  return [...matches].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
}

export function countLeadingWinsInRow(
  completedSortedNewestFirst: MatchRow[],
  myGroupPlayerId: string,
): number {
  let n = 0
  for (const m of completedSortedNewestFirst) {
    if (getMatchOutcome(m, myGroupPlayerId) === 'win') n += 1
    else break
  }
  return n
}

export function allWinsAreStraightSets(
  completed: MatchRow[],
  myGroupPlayerId: string,
): boolean {
  const mine = completed.filter((m) => getMatchOutcome(m, myGroupPlayerId) === 'win')
  if (mine.length === 0) return false
  for (const m of mine) {
    const sets = getPlayerPerspectiveScoreSets(m, myGroupPlayerId) ?? m.score_raw
    if (!sets?.length) return false
    const wonSets = sets.filter((s) => s.a > s.b).length
    const lostSets = sets.filter((s) => s.b > s.a).length
    if (lostSets > 0) return false
    if (wonSets < 2) return false
  }
  return true
}

export function shortDateTimeLabel(iso: string): { line1: string; line2: string } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const day = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(d)
  const time = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(d)
  if (isToday) return { line1: 'Hoy', line2: time }
  return { line1: day, line2: time }
}
