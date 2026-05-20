import type { QueryClient } from '@tanstack/react-query'

import type { PlayerDashboardData } from '@/services/dashboardPlayer'
import { buildPlayerViewModel, type PlayerViewModel } from '@/services/playerViewModel'
import type { PreparedPlayerScoreSubmission } from '@/services/matches'
import type { MatchRow } from '@/types/database'
import { computeGroupRanking } from '@/utils/ranking'
import { scorePayloadToSets } from '@/utils/score'

/**
 * Fusiona el partido como tras `submit_player_match_result` (optimista alineado con BD: `closed`).
 */
export function mergeMatchAfterPlayerSubmit(
  match: MatchRow,
  prepared: PreparedPlayerScoreSubmission,
  actorUserId: string,
): MatchRow {
  const now = new Date().toISOString()
  const sets = scorePayloadToSets(prepared.payload)
  const score_raw: MatchRow['score_raw'] =
    prepared.payload.game_type === 'sudden_death'
      ? sets.length === 3
        ? sets
        : match.score_raw
      : sets

  return {
    ...match,
    score_raw,
    winner_id: prepared.winnerId,
    game_type: prepared.payload.game_type,
    result_type: 'normal',
    status: 'closed',
    score_submitted_by: actorUserId,
    score_submitted_at: now,
    opponent_confirmed_by: null,
    opponent_confirmed_at: null,
    dispute_reason: null,
    updated_at: now,
    locked_at: match.locked_at ?? now,
    updated_by: actorUserId,
    closed_at: now,
    admin_validated_by: null,
    admin_validated_at: null,
    confirmed_at: now,
    confirmed_by: actorUserId,
  }
}

export function mergeMatchAfterOpponentReject(match: MatchRow, actorUserId: string, disputeReason: string): MatchRow {
  const now = new Date().toISOString()
  return {
    ...match,
    status: 'score_disputed',
    dispute_reason: disputeReason.trim(),
    disputed_by: actorUserId,
    disputed_at: now,
    closed_at: null,
    admin_validated_by: null,
    admin_validated_at: null,
    updated_at: now,
    updated_by: actorUserId,
  }
}

export function patchPlayerViewModelMatches(
  prev: PlayerViewModel | null | undefined,
  userId: string,
  matchId: string,
  nextMatch: MatchRow,
): PlayerViewModel | null {
  if (!prev) return null
  const nextMatches = prev.data.matches.map((m) => (m.id === matchId ? nextMatch : m))
  const nextRanking = computeGroupRanking(prev.data.players, nextMatches, prev.data.rules)
  const nextData: PlayerDashboardData = { ...prev.data, matches: nextMatches, ranking: nextRanking }
  return buildPlayerViewModel(nextData, userId)
}

/** Tras RPC `opponent_respond` con rechazo: merge local + `playerViewModel` del grupo. */
export function patchPlayerViewModelAfterOpponentReject(
  qc: QueryClient,
  userId: string,
  match: MatchRow,
  disputeReason: string,
): MatchRow {
  const merged = mergeMatchAfterOpponentReject(match, userId, disputeReason)
  qc.setQueryData<PlayerViewModel | null>(['playerViewModel', userId, match.group_id], (old) =>
    patchPlayerViewModelMatches(old, userId, match.id, merged),
  )
  return merged
}

/** Solo movimiento de torneo: el view model del jugador ya va parcheado con `setQueryData`. */
export function invalidatePlayerTournamentMovementQuery(
  qc: QueryClient,
  opts: { userId: string; tournamentId: string },
): void {
  void qc.invalidateQueries({ queryKey: ['playerTournamentMovement', opts.userId, opts.tournamentId] })
}
