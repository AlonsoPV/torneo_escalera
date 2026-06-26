import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MatchRow, TournamentRules } from '@/types/database'

const rpcMock = vi.fn()
const singleMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => singleMock(),
        }),
      }),
    }),
  },
}))

import { adminValidateDisputedWithoutChanges, preparePlayerScoreSubmissionSync } from '@/services/matches'

function disputedMatch(overrides?: Partial<MatchRow>): MatchRow {
  return {
    id: 'match-1',
    status: 'score_disputed',
    winner_id: 'player-a-gp',
    score_raw: [{ a: 6, b: 4 }],
    result_type: 'normal',
    game_type: 'best_of_3',
    ...overrides,
  } as MatchRow
}

describe('adminValidateDisputedWithoutChanges', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    singleMock.mockReset()
    rpcMock.mockResolvedValue({ error: null })
    singleMock.mockImplementation(async () => ({
      data: disputedMatch(),
      error: null,
    }))
  })

  it('valida disputa vía admin_set_match_result → closed (RPC 042+ lo mapea a validated)', async () => {
    const match = disputedMatch()
    await adminValidateDisputedWithoutChanges(match)

    expect(singleMock).toHaveBeenCalledOnce()
    expect(rpcMock).toHaveBeenCalledOnce()
    expect(rpcMock).toHaveBeenCalledWith('admin_set_match_result', {
      p_match_id: 'match-1',
      p_score: [{ a: 6, b: 4 }],
      p_winner_id: 'player-a-gp',
      p_status: 'closed',
      p_result_type: 'normal',
      p_game_type: 'best_of_3',
    })
  })

  it('rechaza partidos que no están en score_disputed', async () => {
    singleMock.mockResolvedValueOnce({
      data: disputedMatch({ status: 'closed' }),
      error: null,
    })

    await expect(adminValidateDisputedWithoutChanges(disputedMatch())).rejects.toThrow(
      'Solo aplica a partidos pendientes de revisión administrativa.',
    )
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('rechaza si falta ganador', async () => {
    singleMock.mockResolvedValueOnce({
      data: disputedMatch({ winner_id: null }),
      error: null,
    })

    await expect(adminValidateDisputedWithoutChanges(disputedMatch())).rejects.toThrow(
      'Falta ganador en el registro actual.',
    )
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('propaga errores del RPC (p. ej. no admin)', async () => {
    rpcMock.mockResolvedValue({ error: { message: 'Solo staff', code: 'P0001' } })
    await expect(adminValidateDisputedWithoutChanges(disputedMatch())).rejects.toThrow('Solo staff')
  })
})

describe('preparePlayerScoreSubmissionSync retirement inference', () => {
  const rules = {
    best_of_sets: 3,
    games_per_set: 6,
    set_points: 6,
  } as TournamentRules

  it('prepara marcador normal 2-6, 6-4, 7-5 con ganador del lado izquierdo', () => {
    const prepared = preparePlayerScoreSubmissionSync({
      match: disputedMatch({
        player_a_id: 'player-a-gp',
        player_b_id: 'player-b-gp',
      }),
      scorePayload: {
        game_type: 'best_of_3',
        score_json: [
          { a: 2, b: 6 },
          { a: 6, b: 4 },
          { a: 7, b: 5 },
        ],
        winner: 'a',
      },
      rules,
    })

    expect(prepared.resultType).toBe('normal')
    expect(prepared.winnerId).toBe('player-a-gp')
    expect(prepared.pScoreJson).toEqual([
      { a: 2, b: 6 },
      { a: 6, b: 4 },
      { a: 7, b: 5 },
    ])
  })

  it('convierte retiro empatado a retired_draw sin exigir otra opcion', () => {
    const prepared = preparePlayerScoreSubmissionSync({
      match: disputedMatch({
        player_a_id: 'player-a-gp',
        player_b_id: 'player-b-gp',
      }),
      scorePayload: {
        game_type: 'best_of_3',
        score_json: [{ a: 6, b: 6 }],
        winner: null,
        result_type: 'retired',
      },
      rules,
    })

    expect(prepared.resultType).toBe('retired_draw')
    expect(prepared.winnerId).toBeNull()
  })

  it('mantiene retiro con ganador cuando un jugador lleva mas games', () => {
    const prepared = preparePlayerScoreSubmissionSync({
      match: disputedMatch({
        player_a_id: 'player-a-gp',
        player_b_id: 'player-b-gp',
      }),
      scorePayload: {
        game_type: 'best_of_3',
        score_json: [{ a: 8, b: 6 }],
        winner: 'a',
        result_type: 'retired',
      },
      rules,
    })

    expect(prepared.resultType).toBe('retired')
    expect(prepared.winnerId).toBe('player-a-gp')
  })

  it('permite retiro en muerte subita indicando ganador por retiro del rival', () => {
    const prepared = preparePlayerScoreSubmissionSync({
      match: disputedMatch({
        player_a_id: 'player-a-gp',
        player_b_id: 'player-b-gp',
        game_type: 'sudden_death',
      }),
      scorePayload: {
        game_type: 'sudden_death',
        score_json: null,
        winner: 'b',
        result_type: 'retired',
      },
      rules,
    })

    expect(prepared.resultType).toBe('retired')
    expect(prepared.winnerId).toBe('player-b-gp')
    expect(prepared.pScoreJson).toBeNull()
  })

  it('permite retiro de ambos en muerte subita sin ganador', () => {
    const prepared = preparePlayerScoreSubmissionSync({
      match: disputedMatch({
        player_a_id: 'player-a-gp',
        player_b_id: 'player-b-gp',
        game_type: 'sudden_death',
      }),
      scorePayload: {
        game_type: 'sudden_death',
        score_json: null,
        winner: null,
        result_type: 'retired_draw',
      },
      rules,
    })

    expect(prepared.resultType).toBe('retired_draw')
    expect(prepared.winnerId).toBeNull()
    expect(prepared.pScoreJson).toBeNull()
  })

  it('permite W.O. con ganador y marcador administrativo 6-3, 6-3', () => {
    const prepared = preparePlayerScoreSubmissionSync({
      match: disputedMatch({
        player_a_id: 'player-a-gp',
        player_b_id: 'player-b-gp',
      }),
      scorePayload: {
        game_type: 'best_of_3',
        score_json: null,
        winner: 'a',
        result_type: 'wo',
      },
      rules,
    })

    expect(prepared.resultType).toBe('wo')
    expect(prepared.winnerId).toBe('player-a-gp')
    expect(prepared.pScoreJson).toEqual([
      { a: 6, b: 3 },
      { a: 6, b: 3 },
    ])
  })

  it('orienta el marcador administrativo W.O. si gana jugador B', () => {
    const prepared = preparePlayerScoreSubmissionSync({
      match: disputedMatch({
        player_a_id: 'player-a-gp',
        player_b_id: 'player-b-gp',
      }),
      scorePayload: {
        game_type: 'best_of_3',
        score_json: null,
        winner: 'b',
        result_type: 'wo',
      },
      rules,
    })

    expect(prepared.resultType).toBe('wo')
    expect(prepared.winnerId).toBe('player-b-gp')
    expect(prepared.pScoreJson).toEqual([
      { a: 3, b: 6 },
      { a: 3, b: 6 },
    ])
  })
})
