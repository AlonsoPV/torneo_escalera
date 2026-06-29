import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IMPORT_ADMIN_PENALTY_SCORE } from '@/lib/matchResultSemantics'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'

const getAdminGroupsForTournamentMock = vi.fn()
const getTournamentRulesMock = vi.fn()
const updateTournamentMock = vi.fn()
const supabaseFromMock = vi.fn()

vi.mock('@/services/admin', () => ({
  getAdminGroupsForTournament: getAdminGroupsForTournamentMock,
}))

vi.mock('@/services/tournaments', () => ({
  getTournamentRules: getTournamentRulesMock,
  updateTournament: updateTournamentMock,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseFromMock,
  },
}))

function rules(): TournamentRules {
  return {
    tournament_id: 't1',
    points_per_win: 3,
    points_per_loss: 1,
    points_default_win: 3,
    points_default_loss: -1,
    best_of_sets: 3,
  } as TournamentRules
}

function gp(id: string, userId: string, name: string, seedOrder: number): GroupPlayer {
  return {
    id,
    user_id: userId,
    group_id: 'g1',
    display_name: name,
    seed_order: seedOrder,
    created_at: '',
  } as GroupPlayer
}

function match(partial: Partial<MatchRow>): MatchRow {
  return {
    id: 'm1',
    tournament_id: 't1',
    group_id: 'g1',
    player_a_id: 'pa',
    player_b_id: 'pb',
    player_a_user_id: 'ua',
    player_b_user_id: 'ub',
    status: 'pending_score',
    result_type: 'normal',
    game_type: 'best_of_3',
    score_raw: null,
    winner_id: null,
    ...partial,
  } as MatchRow
}

describe('finishTournament', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cierra partidos sin marcador como no reportados y guarda posiciones con -1 y 3-6, 3-6 para ambos', async () => {
    const { finishTournament } = await import('@/services/tournamentClosure')
    const players = [gp('pa', 'ua', 'Jugador A', 1), gp('pb', 'ub', 'Jugador B', 2)]
    const pendingGroup = {
      id: 'g1',
      order_index: 1,
      players,
      matches: [match({ status: 'pending_score', result_type: 'normal', score_raw: null, winner_id: null })],
    }
    const closedGroup = {
      ...pendingGroup,
      matches: [
        match({
          status: 'closed',
          result_type: 'not_reported',
          score_raw: IMPORT_ADMIN_PENALTY_SCORE,
          winner_id: null,
        }),
      ],
    }

    getAdminGroupsForTournamentMock
      .mockResolvedValueOnce([pendingGroup])
      .mockResolvedValueOnce([closedGroup])
      .mockResolvedValueOnce([closedGroup])
    getTournamentRulesMock.mockResolvedValue(rules())

    let matchUpdatePayload: Record<string, unknown> | undefined
    let snapshotRows: Array<Record<string, unknown>> | undefined
    const matchesQuery = {
      update: vi.fn((payload: Record<string, unknown>) => {
        matchUpdatePayload = payload
        return matchesQuery
      }),
      eq: vi.fn(() => matchesQuery),
      is: vi.fn(() => matchesQuery),
      select: vi.fn(async () => ({ data: [{ id: 'm1' }], error: null })),
    }
    const standingsQuery = {
      delete: vi.fn(() => standingsQuery),
      eq: vi.fn(async () => ({ error: null })),
      insert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
        snapshotRows = rows
        return { error: null }
      }),
    }
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'matches') return matchesQuery
      if (table === 'tournament_final_standings') return standingsQuery
      throw new Error(`Unexpected table ${table}`)
    })
    updateTournamentMock.mockResolvedValue(undefined)

    await finishTournament({ tournamentId: 't1', closedBy: 'admin-user' })

    expect(matchUpdatePayload).toMatchObject({
      status: 'closed',
      result_type: 'not_reported',
      score_raw: IMPORT_ADMIN_PENALTY_SCORE,
      winner_id: null,
    })
    expect(snapshotRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          player_id: 'ua',
          points: -1,
          games_for: 6,
          games_against: 12,
          games_difference: -6,
          losses: 1,
          position: 1,
        }),
        expect.objectContaining({
          player_id: 'ub',
          points: -1,
          games_for: 6,
          games_against: 12,
          games_difference: -6,
          losses: 1,
          position: 2,
        }),
      ]),
    )
  })
})
