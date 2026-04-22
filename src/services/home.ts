import { supabase } from '@/lib/supabase'
import { listGroupPlayers, listGroups } from '@/services/groups'
import { listMatchesForGroup } from '@/services/matches'
import { getTournamentRules, listTournaments } from '@/services/tournaments'
import type { MatchRow, Tournament } from '@/types/database'
import { computeGroupRanking, type RankingRow } from '@/utils/ranking'
import { formatScoreCompact } from '@/utils/score'

export type RecentMatchResult = {
  matchId: string
  updatedAt: string
  tournamentId: string
  tournamentName: string
  groupId: string
  playerAName: string
  playerBName: string
  winnerName: string
  scoreLabel: string
}

export type GlobalLeaderboardRow = {
  position: number
  userId: string
  displayName: string
  points: number
  wins: number
  losses: number
  played: number
  tournamentsCount: number
}

const TOURNAMENT_CAP = 15

function sortTournamentsForLeaderboard(tournaments: Tournament[]): Tournament[] {
  const statusOrder: Record<string, number> = { active: 0, finished: 1, draft: 2 }
  return [...tournaments].sort((a, b) => {
    const oa = statusOrder[a.status] ?? 99
    const ob = statusOrder[b.status] ?? 99
    if (oa !== ob) return oa - ob
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export async function getRecentMatchResults(limit = 20): Promise<RecentMatchResult[]> {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .not('winner_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  const rows = (matches ?? []) as MatchRow[]
  if (rows.length === 0) return []

  const tournamentIds = [...new Set(rows.map((m) => m.tournament_id))]
  const playerIds = new Set<string>()
  for (const m of rows) {
    playerIds.add(m.player_a_id)
    playerIds.add(m.player_b_id)
    if (m.winner_id) playerIds.add(m.winner_id)
  }

  const [tRes, pRes] = await Promise.all([
    supabase.from('tournaments').select('id,name').in('id', tournamentIds),
    supabase.from('group_players').select('id,display_name').in('id', [...playerIds]),
  ])

  if (tRes.error) throw tRes.error
  if (pRes.error) throw pRes.error

  const tournamentNames = new Map(
    ((tRes.data ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]),
  )
  const playerNames = new Map(
    ((pRes.data ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]),
  )

  return rows.map((m) => {
    const sets = m.score_raw ?? []
    return {
      matchId: m.id,
      updatedAt: m.updated_at,
      tournamentId: m.tournament_id,
      tournamentName: tournamentNames.get(m.tournament_id) ?? 'Torneo',
      groupId: m.group_id,
      playerAName: playerNames.get(m.player_a_id) ?? '—',
      playerBName: playerNames.get(m.player_b_id) ?? '—',
      winnerName: m.winner_id ? (playerNames.get(m.winner_id) ?? '—') : '—',
      scoreLabel: formatScoreCompact(sets),
    }
  })
}

export async function buildGlobalLeaderboard(): Promise<GlobalLeaderboardRow[]> {
  const tournaments = sortTournamentsForLeaderboard(await listTournaments()).slice(0, TOURNAMENT_CAP)

  type Acc = {
    userId: string
    displayName: string
    points: number
    wins: number
    losses: number
    played: number
    tournaments: Set<string>
  }
  const merged = new Map<string, Acc>()

  const mergeRows = (rows: RankingRow[], tournamentId: string) => {
    for (const r of rows) {
      const ex = merged.get(r.userId)
      if (!ex) {
        merged.set(r.userId, {
          userId: r.userId,
          displayName: r.displayName,
          points: r.points,
          wins: r.won,
          losses: r.lost,
          played: r.played,
          tournaments: new Set([tournamentId]),
        })
      } else {
        ex.points += r.points
        ex.wins += r.won
        ex.losses += r.lost
        ex.played += r.played
        ex.tournaments.add(tournamentId)
      }
    }
  }

  for (const t of tournaments) {
    const rules = await getTournamentRules(t.id)
    if (!rules) continue
    const groups = await listGroups(t.id)
    for (const g of groups) {
      const players = await listGroupPlayers(g.id)
      if (players.length === 0) continue
      const matches = await listMatchesForGroup(g.id)
      const rows = computeGroupRanking(players, matches, rules)
      mergeRows(rows, t.id)
    }
  }

  const sorted = Array.from(merged.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    const ad = a.wins - a.losses
    const bd = b.wins - b.losses
    if (bd !== ad) return bd - ad
    return a.displayName.localeCompare(b.displayName)
  })

  return sorted.map((r, idx) => ({
    position: idx + 1,
    userId: r.userId,
    displayName: r.displayName,
    points: r.points,
    wins: r.wins,
    losses: r.losses,
    played: r.played,
    tournamentsCount: r.tournaments.size,
  }))
}
