import { describe, expect, it } from 'vitest'

import { validateTennisScore } from '@/lib/tournamentRulesEngine'
import type { TournamentRules } from '@/types/database'

const bo3Rules = {
  best_of_sets: 3,
  set_points: 6,
  games_per_set: 6,
  min_game_difference: 2,
  tiebreak_enabled: true,
  tiebreak_at: 6,
  final_set_format: 'super_tiebreak',
  super_tiebreak_final_set: true,
} as TournamentRules

describe('validateTennisScore — set decisivo', () => {
  it('acepta super tie-break 1-0 en set 3', () => {
    const result = validateTennisScore(
      [
        { a: 6, b: 4 },
        { a: 4, b: 6 },
        { a: 1, b: 0 },
      ],
      bo3Rules,
    )
    expect(result.ok).toBe(true)
  })

  it('acepta marcador corto distinto de 1-0 en set 3', () => {
    const result = validateTennisScore(
      [
        { a: 6, b: 4 },
        { a: 4, b: 6 },
        { a: 10, b: 8 },
      ],
      bo3Rules,
    )
    expect(result.ok).toBe(true)
  })

  it('acepta marcador clásico 6-2 en set 3', () => {
    const result = validateTennisScore(
      [
        { a: 6, b: 4 },
        { a: 4, b: 6 },
        { a: 6, b: 2 },
      ],
      bo3Rules,
    )
    expect(result.ok).toBe(true)
  })
})
