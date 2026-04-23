import { listGroupPlayers } from '@/services/groups'
import { listMatchesForGroup } from '@/services/matches'
import { getTournamentRules } from '@/services/tournaments'
import type { Group, GroupPlayer, MatchRow, Tournament, TournamentRules } from '@/types/database'
import { computeGroupRanking, type RankingRow } from '@/utils/ranking'
import { supabase } from '@/lib/supabase'

export type PlayerDashboardData = {
  tournament: Tournament
  group: Group
  membership: GroupPlayer
  players: GroupPlayer[]
  matches: MatchRow[]
  rules: TournamentRules
  ranking: RankingRow[]
}

type JoinRow = GroupPlayer & { group: (Group & { tournament?: Tournament | Tournament[] | null }) | null }

export async function getPlayerDashboardData(
  userId: string,
): Promise<PlayerDashboardData | null> {
  const { data, error } = await supabase
    .from('group_players')
    .select('*, group: groups (*, tournament: tournaments(*))')
    .eq('user_id', userId)
  if (error) throw error
  for (const raw of (data ?? []) as JoinRow[]) {
    const g = raw.group
    if (!g) continue
    const tRaw = g.tournament
    const t = (Array.isArray(tRaw) ? tRaw[0] : tRaw) as Tournament | null | undefined
    if (t && t.status === 'active') {
      const { tournament: _emb, ...groupRow } = g
      const players = await listGroupPlayers(g.id)
      const matches = await listMatchesForGroup(g.id)
      const rules = await getTournamentRules(t.id)
      if (!rules) continue
      const { group: _g, ...rest } = raw
      const membership = rest as GroupPlayer
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
  }
  return null
}
