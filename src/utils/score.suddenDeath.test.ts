import { describe, expect, it } from 'vitest'

import {
  getSuddenDeathWinnerSide,
  validateSuddenDeathMatchScore,
  validateSuddenDeathScore,
  validateSuddenDeathThirdSet,
} from '@/utils/score'

describe('validateSuddenDeathThirdSet', () => {
  it('solo acepta 1-0 o 0-1', () => {
    expect(validateSuddenDeathThirdSet({ a: 1, b: 0 })).toBeNull()
    expect(validateSuddenDeathThirdSet({ a: 0, b: 1 })).toBeNull()
    expect(validateSuddenDeathThirdSet({ a: 7, b: 0 })).not.toBeNull()
    expect(validateSuddenDeathThirdSet({ a: 10, b: 8 })).not.toBeNull()
    expect(validateSuddenDeathThirdSet({ a: 6, b: 5 })).not.toBeNull()
  })

  it('rechaza empate', () => {
    expect(validateSuddenDeathThirdSet({ a: 0, b: 0 })).not.toBeNull()
    expect(validateSuddenDeathThirdSet({ a: 1, b: 1 })).not.toBeNull()
  })
})

describe('validateSuddenDeathMatchScore', () => {
  it('exige exactamente 3 sets', () => {
    const two = validateSuddenDeathMatchScore(
      [
        { a: 6, b: 4 },
        { a: 6, b: 3 },
      ],
      null,
    )
    expect(two.ok).toBe(false)
    expect(two.errors.some((e) => e.includes('3'))).toBe(true)
  })

  it('el ganador del partido es solo el del set 3 (aunque vaya 0-2 en sets)', () => {
    const sets = [
      { a: 0, b: 6 },
      { a: 0, b: 6 },
      { a: 1, b: 0 },
    ]
    const v = validateSuddenDeathMatchScore(sets, null)
    expect(v.ok).toBe(true)
    expect(v.winner).toBe('a')
    expect(getSuddenDeathWinnerSide(sets)).toBe('a')
  })

  it('validateSuddenDeathScore exige coherencia con winner lateral', () => {
    const sets = [
      { a: 6, b: 4 },
      { a: 6, b: 4 },
      { a: 0, b: 1 },
    ]
    const ok = validateSuddenDeathScore({
      game_type: 'sudden_death',
      score_json: sets,
      winner: 'b',
    })
    expect(ok.ok).toBe(true)

    const bad = validateSuddenDeathScore({
      game_type: 'sudden_death',
      score_json: sets,
      winner: 'a',
    })
    expect(bad.ok).toBe(false)
    expect(bad.errors.some((e) => e.includes('tercer set'))).toBe(true)
  })
})
