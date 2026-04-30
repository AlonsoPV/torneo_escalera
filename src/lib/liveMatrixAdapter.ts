import type { GroupPlayer, MatchRow } from '@/types/database'
import type { GroupStandingRow, SimMatch, SimPlayer } from '@/types/tournament'
import type { RankingRow } from '@/utils/ranking'

export function groupPlayersToSimPlayers(players: GroupPlayer[]): SimPlayer[] {
  return players.map((p) => ({
    id: p.id,
    full_name: p.display_name,
    seed_order: p.seed_order,
    group_id: p.group_id,
  }))
}

export function matchRowToSimMatch(m: MatchRow): SimMatch | null {
  if (!m.winner_id) return null
  const sets = m.score_raw
  if (sets && sets.length > 0) {
    return {
      id: m.id,
      groupId: m.group_id,
      playerAId: m.player_a_id,
      playerBId: m.player_b_id,
      resultType: 'normal',
      score: sets,
      winnerId: m.winner_id,
      status: 'closed',
    }
  }
  const winnerIsA = m.winner_id === m.player_a_id
  return {
    id: m.id,
    groupId: m.group_id,
    playerAId: m.player_a_id,
    playerBId: m.player_b_id,
    resultType: 'default',
    defaultWinner: winnerIsA ? 'a' : 'b',
    winnerId: m.winner_id,
    status: 'closed',
  }
}

export function matchRowsToSimMatches(matches: MatchRow[]): SimMatch[] {
  return matches.map(matchRowToSimMatch).filter((m): m is SimMatch => m != null)
}

export function rankingRowsToGroupStandingRows(
  rows: RankingRow[],
  players: GroupPlayer[],
): GroupStandingRow[] {
  const seedById = new Map(players.map((p) => [p.id, p.seed_order]))
  return rows.map((r) => ({
    playerId: r.groupPlayerId,
    displayName: r.displayName,
    seed_order: seedById.get(r.groupPlayerId) ?? 0,
    position: r.position,
    played: r.played,
    won: r.won,
    lost: r.lost,
    defaultsWon: 0,
    defaultsLost: 0,
    setsFor: r.setsFor,
    setsAgainst: r.setsAgainst,
    gamesFor: r.gamesFor,
    gamesAgainst: r.gamesAgainst,
    points: r.points,
  }))
}
