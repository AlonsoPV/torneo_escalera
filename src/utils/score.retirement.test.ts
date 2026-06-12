import { describe, expect, it } from 'vitest'

import { validateIncompleteBestOf3Score } from '@/utils/score'

describe('validateIncompleteBestOf3Score', () => {
  it('permite empate por retiro con un solo set capturado', () => {
    const result = validateIncompleteBestOf3Score([{ a: 1, b: 1 }])

    expect(result.ok).toBe(true)
    expect(result.games).toEqual({ a: 1, b: 1 })
    expect(result.winnerByGames).toBeNull()
  })
})
