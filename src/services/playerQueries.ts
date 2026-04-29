import { getCompletedMatches, sortMatchesByDateDesc } from '@/lib/playerDashboard'
import { getPlayerDashboardData, type PlayerDashboardData } from '@/services/dashboardPlayer'
import type { Group, GroupPlayer, MatchRow, Tournament } from '@/types/database'
import type { RankingRow } from '@/utils/ranking'

import { buildPlayerViewModel, type PlayerViewModel } from './playerViewModel'

/** Carga un torneo activo y membresía; un solo viaje a Supabase vía getPlayerDashboardData. */
export async function getPlayerGroup(userId: string): Promise<{
  group: Group
  tournament: Tournament
  membership: GroupPlayer
} | null> {
  const d = await getPlayerDashboardData(userId)
  if (!d) return null
  return { group: d.group, tournament: d.tournament, membership: d.membership }
}

export async function getPlayerUpcomingMatches(userId: string): Promise<MatchRow[] | null> {
  const d = await getPlayerDashboardData(userId)
  if (!d) return null
  return buildPlayerViewModel(d, userId).upcoming
}

export async function getPlayerMatchHistory(userId: string): Promise<MatchRow[] | null> {
  const d = await getPlayerDashboardData(userId)
  if (!d) return null
  const done = getCompletedMatches(d.membership.id, d.matches)
  return sortMatchesByDateDesc(done)
}

export async function getPlayerSummary(userId: string): Promise<PlayerViewModel['summary'] | null> {
  const d = await getPlayerDashboardData(userId)
  if (!d) return null
  return buildPlayerViewModel(d, userId).summary
}

export async function getPlayerStanding(userId: string): Promise<RankingRow | null> {
  const d = await getPlayerDashboardData(userId)
  if (!d) return null
  return buildPlayerViewModel(d, userId).myStanding
}

export type { PlayerDashboardData, PlayerViewModel }
