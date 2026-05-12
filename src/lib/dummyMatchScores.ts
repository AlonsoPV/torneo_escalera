import type { MatchGameType, MatchRow, ScorePayload } from '@/types/database'

function hashUnit(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 2 ** 32
}

export function pickDummyWinnerId(match: Pick<MatchRow, 'id' | 'player_a_id' | 'player_b_id'>): string {
  const u = hashUnit(`${match.id}:${match.player_a_id}:${match.player_b_id}`)
  return u < 0.5 ? match.player_a_id : match.player_b_id
}

/** Reparto de formatos según cantidad de partidos del grupo (~75% BO3, resto long_set y sudden_death cuando hay ≥3 cruces). */
export function dummyGameTypeForMatchOrdinal(ordinal: number, totalMatches: number): MatchGameType {
  if (totalMatches <= 0) return 'best_of_3'
  if (totalMatches < 3) return 'best_of_3'
  if (ordinal === totalMatches - 1) return 'sudden_death'
  if (ordinal === totalMatches - 2) return 'long_set'
  return 'best_of_3'
}

export function buildDummyScorePayload(
  match: Pick<MatchRow, 'id' | 'player_a_id' | 'player_b_id'>,
  gameType: MatchGameType,
  winnerId: string,
): ScorePayload {
  const winnerIsA = winnerId === match.player_a_id

  if (gameType === 'sudden_death') {
    return { game_type: 'sudden_death', score_json: null, winner: winnerIsA ? 'a' : 'b' }
  }

  if (gameType === 'long_set') {
    const templatesWinnerA = [
      { a: 9, b: 7 },
      { a: 10, b: 8 },
      { a: 8, b: 6 },
      { a: 12, b: 10 },
    ]
    const templatesWinnerB = templatesWinnerA.map((s) => ({ a: s.b, b: s.a }))
    const pool = winnerIsA ? templatesWinnerA : templatesWinnerB
    const idx = Math.floor(hashUnit(`${match.id}:long`) * pool.length)
    const set = pool[idx]!
    return { game_type: 'long_set', score_json: [set], winner: winnerIsA ? 'a' : 'b' }
  }

  const twoSetWinnerA = [
    [
      { a: 6, b: 2 },
      { a: 6, b: 4 },
    ],
    [
      { a: 6, b: 3 },
      { a: 7, b: 6 },
    ],
    [
      { a: 7, b: 5 },
      { a: 6, b: 2 },
    ],
  ]
  const twoSetWinnerB = twoSetWinnerA.map((pair) => pair.map((s) => ({ a: s.b, b: s.a })))
  const pool = winnerIsA ? twoSetWinnerA : twoSetWinnerB
  const idx = Math.floor(hashUnit(`${match.id}:bo3`) * pool.length)
  const sets = pool[idx]!
  return { game_type: 'best_of_3', score_json: sets, winner: winnerIsA ? 'a' : 'b' }
}
