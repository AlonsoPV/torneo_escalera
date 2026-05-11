import { supabase } from '@/lib/supabase'
import { listGroupPlayers } from '@/services/groups'
import { listMatchesForGroup } from '@/services/matches'
import { getTournamentRules } from '@/services/tournaments'
import type { Group, GroupPlayer, MatchRow, Tournament, TournamentRules, TournamentStatus } from '@/types/database'
import { computeGroupRanking, type RankingRow } from '@/utils/ranking'

export type PlayerDashboardData = {
  tournament: Tournament
  group: Group
  membership: GroupPlayer
  players: GroupPlayer[]
  matches: MatchRow[]
  rules: TournamentRules
  ranking: RankingRow[]
}

export type PlayerDashboardContextSummary = {
  group: Group
  tournament: Tournament
  membership: GroupPlayer
}

type JoinRow = GroupPlayer & { group: (Group & { tournament?: Tournament | Tournament[] | null }) | null }

function tournamentStatusRank(status: TournamentStatus): number {
  if (status === 'active') return 0
  if (status === 'finished') return 1
  if (status === 'archived') return 2
  return 3
}

export async function listPlayerDashboardContexts(userId: string): Promise<PlayerDashboardContextSummary[]> {
  const { data, error } = await supabase
    .from('group_players')
    .select('*, group: groups (*, tournament: tournaments(*))')
    .eq('user_id', userId)
  if (error) throw error
  const out: PlayerDashboardContextSummary[] = []
  for (const raw of (data ?? []) as JoinRow[]) {
    const g = raw.group
    if (!g) continue
    const tRaw = g.tournament
    const t = (Array.isArray(tRaw) ? tRaw[0] : tRaw) as Tournament | null | undefined
    if (!t) continue
    const { tournament: _emb, ...groupRow } = g
    const { group: _g, ...rest } = raw
    const membership = rest as GroupPlayer
    out.push({
      group: groupRow as Group,
      tournament: t,
      membership,
    })
  }
  out.sort((a, b) => {
    const ra = tournamentStatusRank(a.tournament.status)
    const rb = tournamentStatusRank(b.tournament.status)
    if (ra !== rb) return ra - rb
    return new Date(b.tournament.created_at).getTime() - new Date(a.tournament.created_at).getTime()
  })
  return out
}

export function defaultGroupIdFromContexts(contexts: PlayerDashboardContextSummary[]): string | null {
  if (contexts.length === 0) return null
  return contexts[0].group.id
}

export async function getPlayerDashboardDataForGroup(
  userId: string,
  groupId: string,
): Promise<PlayerDashboardData | null> {
  const { data, error } = await supabase
    .from('group_players')
    .select('*, group: groups (*, tournament: tournaments(*))')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .maybeSingle()
  if (error) throw error
  const raw = data as JoinRow | null
  if (!raw?.group) return null
  const g = raw.group
  const tRaw = g.tournament
  const t = (Array.isArray(tRaw) ? tRaw[0] : tRaw) as Tournament | null | undefined
  if (!t) return null
  const { tournament: _emb, ...groupRow } = g
  const { group: _g, ...rest } = raw
  const membership = rest as GroupPlayer
  const players = await listGroupPlayers(g.id)
  const matches = await listMatchesForGroup(g.id)
  const rules = await getTournamentRules(t.id)
  if (!rules) return null
  const ranking = computeGroupRanking(players, matches, rules)
  return {
    tournament: t,
    group: groupRow as Group,
    membership,
    players,
    matches,
    rules,
    ranking,
  }
}

export async function getPlayerDashboardData(userId: string): Promise<PlayerDashboardData | null> {
  const contexts = await listPlayerDashboardContexts(userId)
  const groupId = defaultGroupIdFromContexts(contexts)
  if (!groupId) return null
  return getPlayerDashboardDataForGroup(userId, groupId)
}
