import { supabase } from '@/lib/supabase'
import { listGroupPlayers } from '@/services/groups'
import { listMatchesForGroup } from '@/services/matches'
import { getTournamentRules } from '@/services/tournaments'
import type { Group, GroupPlayer, GroupPlayerContact, MatchRow, Tournament, TournamentRules, TournamentStatus } from '@/types/database'
import { computeGroupRanking, type RankingRow } from '@/utils/ranking'

export type PlayerDashboardData = {
  tournament: Tournament
  group: Group
  membership: GroupPlayer
  players: GroupPlayerContact[]
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
type GroupPlayerContactRow = { user_id: string; phone: string | null }

function withoutKey<T extends Record<string, unknown>, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key)) as Omit<T, K>
}

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
    const groupRow = withoutKey(g, 'tournament')
    const rest = withoutKey(raw, 'group')
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

async function listGroupPlayerContacts(groupId: string): Promise<Map<string, string | null>> {
  const { data, error } = await supabase.rpc('get_group_player_contacts', { p_group_id: groupId })
  if (error) throw error
  return new Map(((data ?? []) as GroupPlayerContactRow[]).map((row) => [row.user_id, row.phone]))
}

export async function getGroupPlayerContactsMap(groupId: string): Promise<Map<string, string | null>> {
  return listGroupPlayerContacts(groupId)
}

export async function getGroupPlayerContactsForGroups(
  groupIds: string[],
): Promise<Map<string, string | null>> {
  if (groupIds.length === 0) return new Map()
  const maps = await Promise.all(groupIds.map((groupId) => listGroupPlayerContacts(groupId)))
  const merged = new Map<string, string | null>()
  for (const map of maps) {
    for (const [userId, phone] of map) merged.set(userId, phone)
  }
  return merged
}

export function withGroupPlayerContacts(
  players: GroupPlayer[],
  phonesByUserId: Map<string, string | null>,
): GroupPlayerContact[] {
  return players.map((player) => ({
    ...player,
    phone: phonesByUserId.get(player.user_id) ?? null,
  }))
}

async function listGroupPlayersWithContact(groupId: string): Promise<GroupPlayerContact[]> {
  const players = await listGroupPlayers(groupId)
  if (players.length === 0) return []
  const phonesByUser = await listGroupPlayerContacts(groupId)
  return players.map((player) => ({
    ...player,
    phone: phonesByUser.get(player.user_id) ?? null,
  }))
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
  const groupRow = withoutKey(g, 'tournament')
  const rest = withoutKey(raw, 'group')
  const membership = rest as GroupPlayer
  const players = await listGroupPlayersWithContact(g.id)
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
