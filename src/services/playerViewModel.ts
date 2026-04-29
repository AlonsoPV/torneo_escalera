import {
  getCompletedMatches,
  getPlayerMatches,
  getPlayerStanding,
  isMatchCompleted,
  sortMatchesByDateDesc,
} from '@/lib/playerDashboard'
import { getPlayerDashboardData, type PlayerDashboardData } from '@/services/dashboardPlayer'
import type { MatchRow, Tournament } from '@/types/database'
import type { RankingRow } from '@/utils/ranking'

export type PlayerSummary = {
  position: number
  points: number
  playedLabel: string
  pendingCount: number
}

export type PlayerViewModel = {
  data: PlayerDashboardData
  myStanding: RankingRow | null
  leader: RankingRow | null
  pointsBehindLeader: number | null
  summary: PlayerSummary
  /** Partidos aún no cerrados a nivel de torneo (seguimiento / acción). */
  upcoming: MatchRow[]
  /** Partidos con resultado computable para el ranking. */
  history: MatchRow[]
}

function sortUpcomingChronological(matches: MatchRow[]): MatchRow[] {
  return [...matches].sort((a, b) => {
    const ta = a.scheduled_start_at ?? a.scheduled_date ?? a.created_at
    const tb = b.scheduled_start_at ?? b.scheduled_date ?? b.created_at
    return new Date(ta).getTime() - new Date(tb).getTime()
  })
}

function filterUpcomingForPlayer(matches: MatchRow[], membershipId: string): MatchRow[] {
  const mine = getPlayerMatches(membershipId, matches)
  return mine.filter((m) => {
    if (m.status === 'cancelled') return false
    if (m.status === 'confirmed' || m.status === 'corrected') return false
    return true
  })
}

export function buildPlayerViewModel(data: PlayerDashboardData, userId: string): PlayerViewModel {
  const { membership, matches, players, ranking } = data
  const historyMatches = getCompletedMatches(membership.id, matches)
  const my = getPlayerStanding(userId, ranking) ?? null
  const leader = ranking[0] ?? null
  const pointsBehindLeader = my && leader != null ? Math.max(0, leader.points - my.points) : null

  const roundRobin = players.length >= 2 ? players.length - 1 : 0
  const played = my?.played ?? 0
  const pendingCount = getPlayerMatches(membership.id, matches).filter((m) => !isMatchCompleted(m)).length

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
    },
    upcoming: sortUpcomingChronological(filterUpcomingForPlayer(matches, membership.id)),
    history: sortMatchesByDateDesc(historyMatches),
  }
}

export async function getPlayerViewModelSession(userId: string): Promise<PlayerViewModel | null> {
  const d = await getPlayerDashboardData(userId)
  if (!d) return null
  return buildPlayerViewModel(d, userId)
}

export function tournamentStatusLabel(status: Tournament['status']): string {
  if (status === 'draft') return 'Borrador'
  if (status === 'active') return 'En curso'
  return 'Finalizado'
}

export { getPlayerDashboardData } from '@/services/dashboardPlayer'
