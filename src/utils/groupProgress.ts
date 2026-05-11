import type { Group, GroupPlayer, MatchRow } from '@/types/database'
import type { RankingRow } from '@/utils/ranking'
import { RESULT_PENDING_ADMIN_STATUSES } from '@/utils/tournamentMetrics'

export type GroupProgressState = 'not_started' | 'in_progress' | 'complete' | 'pending_validation'

export type GroupProgressItem = {
  groupId: string
  groupName: string
  playerCount: number
  matchesPlayed: number
  matchesTotal: number
  progressPercent: number
  pendingValidationCount: number
  leaderName: string | null
  state: GroupProgressState
}

export function resolveGroupProgressState(
  played: number,
  total: number,
  pendingValidation: number,
): GroupProgressState {
  if (pendingValidation > 0) return 'pending_validation'
  if (total === 0) return 'not_started'
  if (played === 0) return 'not_started'
  if (played >= total) return 'complete'
  return 'in_progress'
}

export function buildGroupProgressItems(
  groups: Group[],
  groupPlayers: GroupPlayer[],
  matches: MatchRow[],
  rankingByGroupId: Map<string, RankingRow[]>,
): GroupProgressItem[] {
  const playersByGroup = new Map<string, GroupPlayer[]>()
  for (const p of groupPlayers) {
    const list = playersByGroup.get(p.group_id) ?? []
    list.push(p)
    playersByGroup.set(p.group_id, list)
  }

  return groups.map((g) => {
    const gMatches = matches.filter((m) => m.group_id === g.id && m.status !== 'cancelled')
    const matchesTotal = gMatches.length
    const matchesPlayed = gMatches.filter((m) => m.status === 'closed').length
    const pendingValidationCount = gMatches.filter((m) =>
      RESULT_PENDING_ADMIN_STATUSES.includes(m.status),
    ).length
    const progressPercent =
      matchesTotal > 0 ? Math.min(100, Math.round((matchesPlayed / matchesTotal) * 100)) : 0

    const rankRows = rankingByGroupId.get(g.id) ?? []
    const leaderName = rankRows.find((r) => r.position === 1)?.displayName ?? null
    const playerCount = playersByGroup.get(g.id)?.length ?? 0

    const state = resolveGroupProgressState(matchesPlayed, matchesTotal, pendingValidationCount)

    return {
      groupId: g.id,
      groupName: g.name,
      playerCount,
      matchesPlayed,
      matchesTotal,
      progressPercent,
      pendingValidationCount,
      leaderName,
      state,
    }
  })
}
