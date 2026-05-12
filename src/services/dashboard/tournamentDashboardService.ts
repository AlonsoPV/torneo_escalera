import { supabase } from '@/lib/supabase'
import { getTournamentRules } from '@/services/tournaments'
import type { Group, GroupPlayer, MatchRow, Tournament, TournamentRules } from '@/types/database'
import { buildGroupProgressItems, type GroupProgressItem } from '@/utils/groupProgress'
import { computeGroupRanking, type RankingRow } from '@/utils/ranking'
import { computeWinnerGroupPlayerId, formatScoreCompact } from '@/utils/score'
import { idsEqual } from '@/utils/tournamentInvert'
import {
  computeScopeMetrics,
  filterMatchesForDashboard,
  type TournamentScopeMetrics,
} from '@/utils/tournamentMetrics'

export type TournamentDashboardMatchStatusFilter = 'all' | MatchRow['status']

export type TournamentDashboardFiltersInput = {
  /** Ámbito por categoría de grupo del torneo (división). */
  groupCategoryId?: 'all' | 'none' | string
  groupId: 'all' | string
  matchStatus: TournamentDashboardMatchStatusFilter
  /** Día concreto (`YYYY-MM-DD`); filtra por `updated_at` ese día (zona local). */
  matchDay?: string
}

export type TournamentLeaderboardEntry = RankingRow & {
  groupId: string
  groupName: string
}

export type TournamentRecentMatch = {
  id: string
  groupId: string
  groupName: string
  playerAName: string
  playerBName: string
  scoreLabel: string
  /** Lado ganador en perspectiva canónica A vs B; null si aún no hay decisión clara. */
  winnerPlayer: 'a' | 'b' | null
  status: MatchRow['status']
  updatedAt: string
  pointsNote: string | null
}

export type TournamentDashboardData = {
  tournament: Tournament
  rules: TournamentRules
  groups: Group[]
  groupPlayers: GroupPlayer[]
  matches: MatchRow[]
  metrics: TournamentScopeMetrics
  leaderboard: TournamentLeaderboardEntry[]
  groupProgress: GroupProgressItem[]
  recentMatches: TournamentRecentMatch[]
}

const RECENT_STATUS_VISIBLE = new Set<MatchRow['status']>([
  'score_submitted',
  'player_confirmed',
  'score_disputed',
  'closed',
])

function sortMergedLeaderboard(a: TournamentLeaderboardEntry, b: TournamentLeaderboardEntry): number {
  if (b.points !== a.points) return b.points - a.points
  if (b.won !== a.won) return b.won - a.won
  const asd = a.setsFor - a.setsAgainst
  const bsd = b.setsFor - b.setsAgainst
  if (bsd !== asd) return bsd - asd
  const agd = a.gamesFor - a.gamesAgainst
  const bgd = b.gamesFor - b.gamesAgainst
  if (bgd !== agd) return bgd - agd
  return a.displayName.localeCompare(b.displayName)
}

/** Ranking oficial del torneo (solo partidos cerrados en computeGroupRanking). */
export function mergeTournamentLeaderboard(
  groups: Group[],
  rankingByGroupId: Map<string, RankingRow[]>,
): TournamentLeaderboardEntry[] {
  const byUser = new Map<string, TournamentLeaderboardEntry>()

  for (const g of groups) {
    const rows = rankingByGroupId.get(g.id) ?? []
    for (const r of rows) {
      const ex = byUser.get(r.userId)
      if (!ex) {
        byUser.set(r.userId, {
          ...r,
          groupId: g.id,
          groupName: g.name,
        })
      } else {
        ex.played += r.played
        ex.won += r.won
        ex.lost += r.lost
        ex.setsFor += r.setsFor
        ex.setsAgainst += r.setsAgainst
        ex.gamesFor += r.gamesFor
        ex.gamesAgainst += r.gamesAgainst
        ex.points += r.points
        if (ex.groupId !== g.id) {
          ex.groupName = `${ex.groupName}, ${g.name}`
        }
      }
    }
  }

  const sorted = Array.from(byUser.values()).sort(sortMergedLeaderboard)
  return sorted.map((r, idx) => ({ ...r, position: idx + 1 }))
}

function playerLabelLookup(groupPlayers: GroupPlayer[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const p of groupPlayers) {
    m.set(p.id, p.display_name)
  }
  return m
}

function buildRecentMatches(
  matches: MatchRow[],
  groups: Group[],
  players: GroupPlayer[],
  rules: TournamentRules,
  limit: number,
): TournamentRecentMatch[] {
  const groupName = new Map(groups.map((g) => [g.id, g.name]))
  const names = playerLabelLookup(players)

  const interesting = matches.filter(
    (m) =>
      m.status !== 'cancelled' &&
      (m.score_raw?.length ||
        m.winner_id ||
        m.status === 'closed' ||
        RECENT_STATUS_VISIBLE.has(m.status)),
  )

  const sorted = [...interesting].sort(
    (a, b) =>
      new Date(b.score_submitted_at ?? b.updated_at).getTime() -
      new Date(a.score_submitted_at ?? a.updated_at).getTime(),
  )

  const out: TournamentRecentMatch[] = []
  for (const m of sorted.slice(0, limit)) {
    const sets = (m.score_raw ?? []) as { a: number; b: number }[]
    const scoreLabel = sets.length ? formatScoreCompact(sets) : '—'
    const aName = names.get(m.player_a_id) ?? 'Jugador A'
    const bName = names.get(m.player_b_id) ?? 'Jugador B'
    let pointsNote: string | null = null
    if (m.status === 'closed' && m.winner_id) {
      const w = m.winner_id
      const winPts = rules.points_per_win
      const lossPts = rules.points_per_loss
      pointsNote =
        w === m.player_a_id
          ? `+${winPts} / +${lossPts}`
          : w === m.player_b_id
            ? `+${lossPts} / +${winPts}`
            : null
    }

    let winnerPlayer: 'a' | 'b' | null = null
    if (m.winner_id) {
      if (idsEqual(m.winner_id, m.player_a_id)) winnerPlayer = 'a'
      else if (idsEqual(m.winner_id, m.player_b_id)) winnerPlayer = 'b'
    } else if (sets.length > 0) {
      const wGp = computeWinnerGroupPlayerId(sets, m.player_a_id, m.player_b_id, rules.best_of_sets)
      if (wGp && idsEqual(wGp, m.player_a_id)) winnerPlayer = 'a'
      else if (wGp && idsEqual(wGp, m.player_b_id)) winnerPlayer = 'b'
    }

    out.push({
      id: m.id,
      groupId: m.group_id,
      groupName: groupName.get(m.group_id) ?? 'Grupo',
      playerAName: aName,
      playerBName: bName,
      scoreLabel,
      winnerPlayer,
      status: m.status,
      updatedAt: m.score_submitted_at ?? m.updated_at,
      pointsNote,
    })
  }
  return out
}

export async function getTournamentDashboardData(
  tournamentId: string,
  filters: TournamentDashboardFiltersInput,
): Promise<TournamentDashboardData | null> {
  const [tournamentRes, rules, groupsRes] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', tournamentId).maybeSingle(),
    getTournamentRules(tournamentId),
    supabase.from('groups').select('*').eq('tournament_id', tournamentId).order('order_index', { ascending: true }),
  ])

  if (tournamentRes.error) throw tournamentRes.error
  if (!tournamentRes.data) return null
  if (!rules) throw new Error('Reglas del torneo no encontradas')

  const tournament = tournamentRes.data as Tournament
  const groupsRaw = (groupsRes.data ?? []) as Group[]
  if (groupsRes.error) throw groupsRes.error

  const cat = filters.groupCategoryId ?? 'all'
  const groups: Group[] =
    cat === 'all'
      ? groupsRaw
      : cat === 'none'
        ? groupsRaw.filter((g) => !g.group_category_id)
        : groupsRaw.filter((g) => g.group_category_id === cat)

  const groupIdList = groups.map((g) => g.id)

  const matchesRes = await supabase.from('matches').select('*').eq('tournament_id', tournamentId)
  if (matchesRes.error) throw matchesRes.error
  const allMatches = (matchesRes.data ?? []) as MatchRow[]

  let allGroupPlayers: GroupPlayer[] = []
  if (groupIdList.length > 0) {
    const playersRes = await supabase.from('group_players').select('*').in('group_id', groupIdList)
    if (playersRes.error) throw playersRes.error
    allGroupPlayers = (playersRes.data ?? []) as GroupPlayer[]
  }

  const groupFilterOk = filters.groupId === 'all' || groups.some((g) => g.id === filters.groupId)
  const effectiveGroupId = groupFilterOk ? filters.groupId : ('all' as const)

  const groupIdsInScope =
    effectiveGroupId === 'all' ? groups.map((g) => g.id) : [effectiveGroupId]

  const matchesInScope =
    effectiveGroupId === 'all'
      ? allMatches
      : allMatches.filter((m) => m.group_id === effectiveGroupId)

  const metrics = computeScopeMetrics(matchesInScope, allGroupPlayers, groupIdsInScope)

  const rankingByGroupId = new Map<string, RankingRow[]>()
  for (const g of groups) {
    const mpl = allGroupPlayers.filter((p) => p.group_id === g.id)
    const mm = allMatches.filter((m) => m.group_id === g.id)
    rankingByGroupId.set(g.id, computeGroupRanking(mpl, mm, rules))
  }

  const leaderboard: TournamentLeaderboardEntry[] =
    effectiveGroupId === 'all'
      ? mergeTournamentLeaderboard(groups, rankingByGroupId)
      : (rankingByGroupId.get(effectiveGroupId) ?? []).map((r) => ({
          ...r,
          groupId: effectiveGroupId,
          groupName: groups.find((g) => g.id === effectiveGroupId)?.name ?? 'Grupo',
        }))

  const groupProgressAll = buildGroupProgressItems(groups, allGroupPlayers, allMatches, rankingByGroupId)
  const groupProgress =
    effectiveGroupId === 'all'
      ? groupProgressAll
      : groupProgressAll.filter((g) => g.groupId === effectiveGroupId)

  const recentSource = filterMatchesForDashboard(allMatches, {
    groupId: effectiveGroupId,
    status: filters.matchStatus,
    matchDay: filters.matchDay,
  })
  const recentMatches = buildRecentMatches(recentSource, groups, allGroupPlayers, rules, 20)

  return {
    tournament,
    rules,
    groups,
    groupPlayers: allGroupPlayers,
    matches: allMatches,
    metrics,
    leaderboard,
    groupProgress,
    recentMatches,
  }
}

export async function getOfficialResults(
  tournamentId: string,
  filters: TournamentDashboardFiltersInput,
): Promise<TournamentRecentMatch[]> {
  const data = await getTournamentDashboardData(tournamentId, {
    ...filters,
    matchStatus: 'closed',
  })
  return data?.recentMatches ?? []
}

export async function getRecentResults(
  tournamentId: string,
  filters: TournamentDashboardFiltersInput,
): Promise<TournamentRecentMatch[]> {
  const data = await getTournamentDashboardData(tournamentId, filters)
  return data?.recentMatches ?? []
}

export async function getDashboardMetrics(
  tournamentId: string,
  filters: TournamentDashboardFiltersInput,
): Promise<TournamentScopeMetrics | null> {
  const data = await getTournamentDashboardData(tournamentId, filters)
  return data?.metrics ?? null
}

export async function listTournamentOptionsForDashboard(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Tournament[]
}
