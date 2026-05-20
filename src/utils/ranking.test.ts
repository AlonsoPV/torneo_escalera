import { describe, expect, it } from 'vitest'

import type { GroupPlayer, MatchRow } from '@/types/database'

import { computeGroupRanking, type RulesPoints } from '@/utils/ranking'

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

describe('computeGroupRanking', () => {
  const pa = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const pb = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  const players = [
    gp({ id: pa, user_id: 'u1', display_name: 'A', seed_order: 1 }),
    gp({ id: pb, user_id: 'u2', display_name: 'B', seed_order: 2 }),
  ]

  it('cuenta victoria normal con winner_id aunque score_raw sea null', () => {
    const m = matchRow({
      id: '11111111-1111-1111-1111-111111111111',
      player_a_id: pa,
      player_b_id: pb,
      winner_id: pa,
      score_raw: null,
      game_type: 'best_of_3',
    })
    const rows = computeGroupRanking(players, [m], rules())
    const ra = rows.find((r) => r.groupPlayerId === pa)!
    const rb = rows.find((r) => r.groupPlayerId === pb)!
    expect(ra.played).toBe(1)
    expect(rb.played).toBe(1)
    expect(ra.won).toBe(1)
    expect(rb.lost).toBe(1)
    expect(ra.points).toBe(3)
    expect(rb.points).toBe(1)
    expect(ra.gamesFor).toBe(0)
    expect(rb.gamesFor).toBe(0)
  })

  it('mismo resultado de puntos con marcador “raro” presente si winner_id coincide', () => {
    const mNull = matchRow({
      id: '22222222-2222-2222-2222-222222222222',
      player_a_id: pa,
      player_b_id: pb,
      winner_id: pa,
      score_raw: null,
    })
    const mScore = matchRow({
      id: '33333333-3333-3333-3333-333333333333',
      player_a_id: pa,
      player_b_id: pb,
      winner_id: pa,
      score_raw: [
        { a: 6, b: 0 },
        { a: 5, b: 0 },
      ],
    })
    const r1 = computeGroupRanking(players, [mNull], rules())
    const r2 = computeGroupRanking(players, [mScore], rules())
    expect(r1.find((r) => r.groupPlayerId === pa)!.points).toBe(r2.find((r) => r.groupPlayerId === pa)!.points)
    expect(r1.find((r) => r.groupPlayerId === pb)!.points).toBe(r2.find((r) => r.groupPlayerId === pb)!.points)
    expect(r2.find((r) => r.groupPlayerId === pa)!.gamesFor).toBe(11)
  })

  it('WO sin marcador usa puntos por default', () => {
    const m = matchRow({
      id: '44444444-4444-4444-4444-444444444444',
      player_a_id: pa,
      player_b_id: pb,
      winner_id: pa,
      result_type: 'wo',
      game_type: 'sudden_death',
      score_raw: null,
    })
    const rows = computeGroupRanking(players, [m], rules())
    expect(rows.find((r) => r.groupPlayerId === pa)!.points).toBe(3)
    expect(rows.find((r) => r.groupPlayerId === pb)!.points).toBe(-1)
  })

  it('sudden_death con 3 sets: games y puntos según marcador; ganador por set 3', () => {
    const m = matchRow({
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
    })
    const rows = computeGroupRanking(players, [m], rules())
    expect(rows.find((r) => r.groupPlayerId === pa)!.won).toBe(0)
    expect(rows.find((r) => r.groupPlayerId === pb)!.won).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pa)!.points).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pb)!.points).toBe(3)
    expect(rows.find((r) => r.groupPlayerId === pa)!.gamesFor).toBe(18)
    expect(rows.find((r) => r.groupPlayerId === pb)!.gamesFor).toBe(15)
  })

  it('DEF sin marcador en BD: puntos por default y games administrativos 6-3, 6-3 desde ganador A', () => {
    const m = matchRow({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      player_a_id: pa,
      player_b_id: pb,
      winner_id: pa,
      result_type: 'def',
      game_type: 'sudden_death',
      score_raw: null,
    })
    const rows = computeGroupRanking(players, [m], rules())
    expect(rows.find((r) => r.groupPlayerId === pa)!.points).toBe(3)
    expect(rows.find((r) => r.groupPlayerId === pb)!.points).toBe(-1)
    expect(rows.find((r) => r.groupPlayerId === pa)!.gamesFor).toBe(12)
    expect(rows.find((r) => r.groupPlayerId === pb)!.gamesFor).toBe(6)
    expect(rows.find((r) => r.groupPlayerId === pa)!.setsFor).toBe(2)
    expect(rows.find((r) => r.groupPlayerId === pb)!.setsFor).toBe(0)
  })

  it('default_win_b sin marcador: marcador sintético a favor de B', () => {
    const m = matchRow({
      id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
      player_a_id: pa,
      player_b_id: pb,
      winner_id: pb,
      result_type: 'default_win_b',
      game_type: 'best_of_3',
      score_raw: null,
    })
    const rows = computeGroupRanking(players, [m], rules())
    expect(rows.find((r) => r.groupPlayerId === pb)!.points).toBe(3)
    expect(rows.find((r) => r.groupPlayerId === pa)!.points).toBe(-1)
    expect(rows.find((r) => r.groupPlayerId === pb)!.gamesFor).toBe(12)
    expect(rows.find((r) => r.groupPlayerId === pa)!.gamesFor).toBe(6)
  })

  it('ignora winner_id que no es A ni B', () => {
    const alien = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    const m = matchRow({
      id: '55555555-5555-5555-5555-555555555555',
      player_a_id: pa,
      player_b_id: pb,
      winner_id: alien,
      score_raw: null,
    })
    const rows = computeGroupRanking(players, [m], rules())
    expect(rows.every((r) => r.played === 0)).toBe(true)
    expect(rows.every((r) => r.points === 0)).toBe(true)
  })

  it('deduplica por match id', () => {
    const mid = '66666666-6666-6666-6666-666666666666'
    const m = matchRow({
      id: mid,
      player_a_id: pa,
      player_b_id: pb,
      winner_id: pa,
      score_raw: null,
    })
    const rows = computeGroupRanking(players, [m, { ...m }], rules())
    expect(rows.find((r) => r.groupPlayerId === pa)!.played).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pa)!.points).toBe(3)
  })

  it('prioriza winner_id si el marcador no define Bo3 (histórico tipo 6-2, 1-2)', () => {
    const m = matchRow({
      id: '88888888-8888-8888-8888-888888888888',
      player_a_id: pa,
      player_b_id: pb,
      winner_id: pa,
      score_raw: [
        { a: 6, b: 2 },
        { a: 1, b: 2 },
      ],
    })
    const rows = computeGroupRanking(players, [m], rules())
    expect(rows.find((r) => r.groupPlayerId === pa)!.won).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pb)!.lost).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pa)!.points).toBe(3)
    expect(rows.find((r) => r.groupPlayerId === pb)!.points).toBe(1)
  })

  it('sin winner_id infiere ganador por marcador resoluble', () => {
    const m = matchRow({
      id: '99999999-9999-9999-9999-999999999999',
      player_a_id: pa,
      player_b_id: pb,
      winner_id: null,
      score_raw: [
        { a: 6, b: 0 },
        { a: 6, b: 1 },
      ],
    })
    const rows = computeGroupRanking(players, [m], rules())
    expect(rows.find((r) => r.groupPlayerId === pa)!.won).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pa)!.points).toBe(3)
    expect(rows.find((r) => r.groupPlayerId === pb)!.points).toBe(1)
  })

  it('legacy points_per_loss = 0 cuenta como +1 para el perdedor', () => {
    const r = { ...rules(), points_per_loss: 0 }
    const m = matchRow({
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      player_a_id: pa,
      player_b_id: pb,
      winner_id: pa,
      score_raw: null,
    })
    const rows = computeGroupRanking(players, [m], r)
    expect(rows.find((row) => row.groupPlayerId === pa)!.points).toBe(3)
    expect(rows.find((row) => row.groupPlayerId === pb)!.points).toBe(1)
  })

  it('cuenta closed con winner_id para la tabla del grupo', () => {
    const m = matchRow({
      id: 'aaaaaaaa-aaaa-bbbb-cccc-cccccccccccc',
      player_a_id: pa,
      player_b_id: pb,
      status: 'closed',
      winner_id: pa,
      score_submitted_by: 'u1',
      score_submitted_at: '2026-01-01T00:00:00Z',
      score_raw: [
        { a: 6, b: 4 },
        { a: 6, b: 2 },
      ],
    })
    const rows = computeGroupRanking(players, [m], rules())
    expect(rows.find((r) => r.groupPlayerId === pa)!.played).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pb)!.played).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pa)!.won).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pb)!.lost).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pa)!.points).toBe(3)
    expect(rows.find((r) => r.groupPlayerId === pb)!.points).toBe(1)
  })

  it('penalización mutua −1 cada uno', () => {
    const m = matchRow({
      id: '77777777-7777-7777-7777-777777777777',
      player_a_id: pa,
      player_b_id: pb,
      winner_id: null,
      result_type: 'double_penalty',
      score_raw: [
        { a: 3, b: 6 },
        { a: 3, b: 6 },
      ],
    })
    const rows = computeGroupRanking(players, [m], rules())
    expect(rows.find((r) => r.groupPlayerId === pa)!.points).toBe(-1)
    expect(rows.find((r) => r.groupPlayerId === pb)!.points).toBe(-1)
    expect(rows.find((r) => r.groupPlayerId === pa)!.played).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pb)!.played).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pa)!.lost).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pb)!.lost).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pa)!.won).toBe(0)
    expect(rows.find((r) => r.groupPlayerId === pb)!.won).toBe(0)
  })

  it('cuenta validated como oficial para la tabla del grupo', () => {
    const m = matchRow({
      id: '22221111-2222-2222-2222-222222222222',
      player_a_id: pa,
      player_b_id: pb,
      status: 'validated',
      winner_id: pa,
      score_raw: [
        { a: 6, b: 4 },
        { a: 6, b: 2 },
      ],
    })
    const rows = computeGroupRanking(players, [m], rules())
    expect(rows.find((r) => r.groupPlayerId === pa)!.played).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pa)!.won).toBe(1)
    expect(rows.find((r) => r.groupPlayerId === pa)!.points).toBe(3)
  })

  it('excluye score_disputed aunque haya winner_id', () => {
    const m = matchRow({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      player_a_id: pa,
      player_b_id: pb,
      status: 'score_disputed',
      winner_id: pa,
      score_raw: [
        { a: 6, b: 4 },
        { a: 6, b: 2 },
      ],
    })
    const rows = computeGroupRanking(players, [m], rules())
    expect(rows.every((r) => r.played === 0)).toBe(true)
    expect(rows.every((r) => r.points === 0)).toBe(true)
  })
})
