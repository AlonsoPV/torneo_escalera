import { describe, expect, it } from 'vitest'

import type { GroupPlayer, MatchRow } from '@/types/database'

import { computeGroupRanking, type RulesPoints } from '@/utils/ranking'
import {
  computeRankingGamesDifference,
  normalizeRankingGamesStats,
  resolveScoreSetsForRankingStats,
  sumScoreSetGames,
} from '@/utils/rankingGames'

function rules(): RulesPoints {
  return {
    points_per_win: 3,
    points_per_loss: 1,
    points_default_win: 3,
    points_default_loss: -1,
    best_of_sets: 3,
  }
}

function gp(partial: Partial<GroupPlayer> & Pick<GroupPlayer, 'id' | 'user_id' | 'display_name'>): GroupPlayer {
  return {
    group_id: 'g1',
    seed_order: 0,
    created_at: '',
    ...partial,
  } as GroupPlayer
}

function matchRow(base: Partial<MatchRow> & Pick<MatchRow, 'id' | 'player_a_id' | 'player_b_id'>): MatchRow {
  return {
    tournament_id: 't1',
    group_id: 'g1',
    player_a_user_id: 'ua',
    player_b_user_id: 'ub',
    status: 'closed',
    result_type: 'normal',
    game_type: 'best_of_3',
    score_raw: null,
    winner_id: null,
    ...base,
  } as MatchRow
}

function expectDiffMatchesJfMinusJc(rows: ReturnType<typeof computeGroupRanking>): void {
  for (const r of rows) {
    expect(r.gamesFor - r.gamesAgainst).toBe(computeRankingGamesDifference(r.gamesFor, r.gamesAgainst))
  }
}

describe('rankingGames', () => {
  it('computeRankingGamesDifference = JF − JC', () => {
    expect(computeRankingGamesDifference(48, 32)).toBe(16)
    expect(computeRankingGamesDifference(10, 14)).toBe(-4)
  })

  it('normalizeRankingGamesStats deriva Diff de JF y JC', () => {
    expect(normalizeRankingGamesStats(48, 32)).toEqual({
      gamesFor: 48,
      gamesAgainst: 32,
      gamesDifference: 16,
    })
  })

  it('sumScoreSetGames suma games por lado', () => {
    const sets = [
      { a: 6, b: 4 },
      { a: 6, b: 4 },
    ]
    expect(sumScoreSetGames(sets, true)).toBe(12)
    expect(sumScoreSetGames(sets, false)).toBe(8)
  })

  it('resolveScoreSetsForRankingStats: Bo3 usa todos los sets', () => {
    const sets = [
      { a: 6, b: 4 },
      { a: 6, b: 2 },
    ]
    expect(
      resolveScoreSetsForRankingStats({
        game_type: 'best_of_3',
        score_raw: sets,
        result_type: 'normal',
        player_a_id: 'a',
        player_b_id: 'b',
        winner_id: 'a',
      }),
    ).toEqual(sets)
  })

  it('resolveScoreSetsForRankingStats: muerte súbita sin marcador → vacío', () => {
    expect(
      resolveScoreSetsForRankingStats({
        game_type: 'sudden_death',
        score_raw: null,
        result_type: 'normal',
        player_a_id: 'a',
        player_b_id: 'b',
        winner_id: 'a',
      }),
    ).toEqual([])
  })

  it('resolveScoreSetsForRankingStats: muerte súbita 3 sets históricos completos', () => {
    const sets = [
      { a: 6, b: 4 },
      { a: 6, b: 4 },
      { a: 6, b: 7 },
    ]
    expect(
      resolveScoreSetsForRankingStats({
        game_type: 'sudden_death',
        score_raw: sets,
        result_type: 'normal',
        player_a_id: 'a',
        player_b_id: 'b',
        winner_id: 'b',
      }),
    ).toEqual(sets)
  })

  it('resolveScoreSetsForRankingStats: muerte súbita mini 1-0 solo cuenta set decisivo', () => {
    const sets = [
      { a: 6, b: 4 },
      { a: 6, b: 4 },
      { a: 1, b: 0 },
    ]
    expect(
      resolveScoreSetsForRankingStats({
        game_type: 'sudden_death',
        score_raw: sets,
        result_type: 'normal',
        player_a_id: 'a',
        player_b_id: 'b',
        winner_id: 'a',
      }),
    ).toEqual([{ a: 1, b: 0 }])
  })
})

describe('computeGroupRanking JF / Diff', () => {
  const p1 = '11111111-1111-1111-1111-111111111111'
  const p2 = '22222222-2222-2222-2222-222222222222'
  const p3 = '33333333-3333-3333-3333-333333333333'
  const p4 = '44444444-4444-4444-4444-444444444444'
  const p5 = '55555555-5555-5555-5555-555555555555'

  const fivePlayers = [
    gp({ id: p1, user_id: 'u1', display_name: 'Campeón', seed_order: 1 }),
    gp({ id: p2, user_id: 'u2', display_name: 'B', seed_order: 2 }),
    gp({ id: p3, user_id: 'u3', display_name: 'C', seed_order: 3 }),
    gp({ id: p4, user_id: 'u4', display_name: 'D', seed_order: 4 }),
    gp({ id: p5, user_id: 'u5', display_name: 'E', seed_order: 5 }),
  ]

  it('round robin 5: invicto 6-4, 6-4 en 4 partidos → 48 JF y Diff +16', () => {
    const winScore = [
      { a: 6, b: 4 },
      { a: 6, b: 4 },
    ]
    const matches = [p2, p3, p4, p5].map((opp, i) =>
      matchRow({
        id: `00000000-0000-0000-0000-00000000000${i + 1}`,
        player_a_id: p1,
        player_b_id: opp,
        winner_id: p1,
        score_raw: winScore,
      }),
    )

    const rows = computeGroupRanking(fivePlayers, matches, rules())
    const champ = rows.find((r) => r.groupPlayerId === p1)!
    expect(champ.won).toBe(4)
    expect(champ.gamesFor).toBe(48)
    expect(champ.gamesAgainst).toBe(32)
    expect(champ.gamesFor - champ.gamesAgainst).toBe(16)
    expectDiffMatchesJfMinusJc(rows)
  })

  it('cada fila cumple Diff = JF − JC en escenarios variados', () => {
    const pa = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const pb = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const players = [
      gp({ id: pa, user_id: 'u1', display_name: 'A', seed_order: 1 }),
      gp({ id: pb, user_id: 'u2', display_name: 'B', seed_order: 2 }),
    ]
    const matches = [
      matchRow({
        id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        player_a_id: pa,
        player_b_id: pb,
        winner_id: pb,
        game_type: 'sudden_death',
        score_raw: [
          { a: 6, b: 4 },
          { a: 6, b: 4 },
          { a: 6, b: 7 },
        ],
      }),
      matchRow({
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        player_a_id: pa,
        player_b_id: pb,
        winner_id: pa,
        game_type: 'sudden_death',
        score_raw: null,
        result_type: 'normal',
      }),
    ]
    expectDiffMatchesJfMinusJc(computeGroupRanking(players, matches, rules()))
  })

  it('muerte súbita solo ganador (sin marcador) no suma games', () => {
    const pa = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const pb = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const players = [
      gp({ id: pa, user_id: 'u1', display_name: 'A', seed_order: 1 }),
      gp({ id: pb, user_id: 'u2', display_name: 'B', seed_order: 2 }),
    ]
    const m = matchRow({
      id: '12121212-1212-1212-1212-121212121212',
      player_a_id: pa,
      player_b_id: pb,
      winner_id: pa,
      game_type: 'sudden_death',
      score_raw: null,
    })
    const rows = computeGroupRanking(players, [m], rules())
    expect(rows.find((r) => r.groupPlayerId === pa)!.gamesFor).toBe(0)
    expect(rows.find((r) => r.groupPlayerId === pb)!.gamesFor).toBe(0)
    expectDiffMatchesJfMinusJc(rows)
  })
})
