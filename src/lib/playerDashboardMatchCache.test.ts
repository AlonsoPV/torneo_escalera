import { describe, expect, it } from 'vitest'

import { mergeMatchAfterPlayerSubmit } from '@/lib/playerDashboardMatchCache'
import type { PreparedPlayerScoreSubmission } from '@/services/matches'
import type { MatchRow } from '@/types/database'

const baseMatch = {
  id: 'match-1',
  tournament_id: 'tournament-1',
  group_id: 'group-1',
  player_a_id: 'gp-a',
  player_b_id: 'gp-b',
  player_a_user_id: 'user-a',
  player_b_user_id: 'user-b',
  score_raw: null,
  game_type: 'best_of_3',
  winner_id: null,
  status: 'pending_score',
  result_type: 'normal',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  locked_at: null,
} as MatchRow

describe('mergeMatchAfterPlayerSubmit', () => {
  it('conserva score_raw administrativo para W.O. en el cache local', () => {
    const prepared = {
      winnerId: 'gp-b',
      payload: {
        game_type: 'best_of_3',
        score_json: null,
        winner: 'b',
        result_type: 'wo',
      },
      pScoreJson: [
        { a: 3, b: 6 },
        { a: 3, b: 6 },
      ],
      resultType: 'wo',
    } satisfies PreparedPlayerScoreSubmission

    const merged = mergeMatchAfterPlayerSubmit(baseMatch, prepared, 'user-b')

    expect(merged.score_raw).toEqual([
      { a: 3, b: 6 },
      { a: 3, b: 6 },
    ])
    expect(merged.winner_id).toBe('gp-b')
    expect(merged.status).toBe('closed')
  })
})
