import {
  getPlayerMatches,
  getPlayerStanding,
  calculateGamesForAndAgainst,
  sortMatchesByDateDesc,
} from '@/lib/playerDashboard'
import { canSubmitScore } from '@/lib/matchStatus'
import { getPlayerDashboardData, getPlayerDashboardDataForGroup, type PlayerDashboardData } from '@/services/dashboardPlayer'
import type { MatchRow, Tournament } from '@/types/database'
import type { RankingRow } from '@/utils/ranking'

export type PlayerSummary = {
  position: number
  points: number
  playedLabel: string
  pendingCount: number
  gamesDifference: number
}

export type PlayerViewModel = {
  data: PlayerDashboardData
  myStanding: RankingRow | null
  leader: RankingRow | null
  pointsBehindLeader: number | null
  summary: PlayerSummary
  /** Partidos del jugador que aún requieren captura o están en disputa (no incluye marcador ya confirmado para tabla ni player_confirmed). */
  upcoming: MatchRow[]
  /** Todos los partidos del jugador en el grupo (por estado), más recientes primero. */
  history: MatchRow[]
}

function sortUpcomingChronological(matches: MatchRow[]): MatchRow[] {
  return [...matches].sort((a, b) => {
    const ta = a.score_submitted_at ?? a.updated_at ?? a.created_at
    const tb = b.score_submitted_at ?? b.updated_at ?? b.created_at
    return new Date(ta).getTime() - new Date(tb).getTime()
  })
}

function filterUpcomingForPlayer(
  matches: MatchRow[],
  membershipId: string,
  userId: string,
  allowPlayerScoreEntry: boolean,
): MatchRow[] {
  const mine = getPlayerMatches(membershipId, matches)
  return mine.filter((m) => {
    if (m.status === 'cancelled') return false
    if (allowPlayerScoreEntry && canSubmitScore(m, userId)) return true
    if (m.status === 'score_disputed') return false
    if (m.status === 'validated') return false
    if (m.status === 'closed') return false
    if (m.status === 'player_confirmed') return false
    if (m.status === 'score_submitted') return false
    return true
  })
}

export function buildPlayerViewModel(data: PlayerDashboardData, userId: string): PlayerViewModel {
  const { membership, matches, players, ranking } = data
  const mine = getPlayerMatches(membership.id, matches)
  const my = getPlayerStanding(userId, ranking) ?? null
  const leader = ranking[0] ?? null
  const pointsBehindLeader = my && leader != null ? Math.max(0, leader.points - my.points) : null

  const roundRobin = players.length >= 2 ? players.length - 1 : 0
  const played = my?.played ?? 0
  const pendingCount = mine.filter((m) =>
    Boolean(data.rules.allow_player_score_entry && canSubmitScore(m, userId)),
  ).length
  const games = calculateGamesForAndAgainst(membership.id, mine, data.rules)

  return {
    data,
    myStanding: my,
    leader,
    pointsBehindLeader,
    summary: {
      position: my?.position ?? 0,
      points: my?.points ?? 0,
      playedLabel: roundRobin > 0 ? `${Math.min(played, roundRobin)}/${roundRobin}` : `${played}/0`,
      pendingCount: pendingCount,
      gamesDifference: games.gamesDifference,
    },
    upcoming: sortUpcomingChronological(
      filterUpcomingForPlayer(matches, membership.id, userId, data.rules.allow_player_score_entry),
    ),
    history: sortMatchesByDateDesc(mine),
  }
}

export async function getPlayerViewModelSession(
  userId: string,
  groupId?: string | null,
): Promise<PlayerViewModel | null> {
  const d = groupId
    ? await getPlayerDashboardDataForGroup(userId, groupId)
    : await getPlayerDashboardData(userId)
  if (!d) return null
  return buildPlayerViewModel(d, userId)
}

export function tournamentStatusLabel(status: Tournament['status']): string {
  if (status === 'draft') return 'Borrador'
  if (status === 'active') return 'En curso'
  if (status === 'finished') return 'Finalizado'
  if (status === 'archived') return 'Archivado'
  return status
}

export {
  defaultGroupIdFromContexts,
  getPlayerDashboardData,
  getPlayerDashboardDataForGroup,
  listPlayerDashboardContexts,
} from '@/services/dashboardPlayer'
