import { importResultTypeBothPenalized, syntheticAdministrativeSetsForDefaultMatch } from '@/lib/matchResultSemantics'
import type { GroupPlayer, MatchRow, ScoreSet } from '@/types/database'
import type { RankingRow } from '@/utils/ranking'
import type { GroupStandingRow, SimMatch, SimPlayer } from '@/types/tournament'

export function groupPlayersToSimPlayers(players: GroupPlayer[], groupId: string): SimPlayer[] {
  return players.map((p) => ({
    id: p.id,
    full_name: p.display_name,
    seed_order: p.seed_order,
    group_id: groupId,
  }))
}

/** Marcador mostrado en matriz / demo: respeta BD o sintético DEF/default_win. */
function matrixScoreForMatch(m: MatchRow): ScoreSet[] | undefined {
  if (m.score_raw?.length) return m.score_raw
  return syntheticAdministrativeSetsForDefaultMatch(m) ?? undefined
}

/** Convierte filas Supabase a celdas de matriz demo (incluye pendientes sin ganador). */
export function matchRowsToSimMatches(matches: MatchRow[], groupId: string): SimMatch[] {
  return matches.map((m) => {
    if (!m.winner_id) {
      if (
        (m.status === 'closed' || m.status === 'validated') &&
        importResultTypeBothPenalized(m.result_type)
      ) {
        return {
          id: m.id,
          groupId,
          playerAId: m.player_a_id,
          playerBId: m.player_b_id,
          resultType: 'normal',
          score: matrixScoreForMatch(m),
          winnerId: null,
          status: 'closed',
        } satisfies SimMatch
      }
      return {
        id: m.id,
        groupId,
        playerAId: m.player_a_id,
        playerBId: m.player_b_id,
        resultType: 'normal',
        winnerId: null,
        status: 'pending_score',
      } satisfies SimMatch
    }
    const isDef =
      m.result_type === 'default_win_a' ||
      m.result_type === 'default_win_b' ||
      m.result_type === 'wo' ||
      m.result_type === 'def'
    return {
      id: m.id,
      groupId,
      playerAId: m.player_a_id,
      playerBId: m.player_b_id,
      resultType: isDef ? 'default' : 'normal',
      score: matrixScoreForMatch(m),
      defaultWinner:
        m.result_type === 'default_win_a'
          ? 'a'
          : m.result_type === 'default_win_b'
            ? 'b'
            : m.result_type === 'wo' || m.result_type === 'def'
              ? m.winner_id === m.player_a_id
                ? 'a'
                : 'b'
              : undefined,
      winnerId: m.winner_id,
      status: 'closed',
    } satisfies SimMatch
  })
}

export function rankingRowsToGroupStandings(
  players: GroupPlayer[],
  rows: RankingRow[],
): GroupStandingRow[] {
  const seedById = new Map(players.map((p) => [p.id, p.seed_order] as const))
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
