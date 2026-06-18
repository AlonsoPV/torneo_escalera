import { describe, expect, it } from 'vitest'

import { validateBestOf3Score } from '@/utils/score'

describe('validateBestOf3Score — set decisivo 1-0', () => {
  const bo3Opts = { allowShortDecisiveSet: true, gamesPerSet: 6 } as const

  it('acepta 6-4, 4-6, 1-0 en «2 de 3 sets»', () => {
    const result = validateBestOf3Score(
      [
        { a: 6, b: 4 },
        { a: 4, b: 6 },
        { a: 1, b: 0 },
      ],
      bo3Opts,
    )
    expect(result.ok).toBe(true)
    expect(result.winner).toBe('a')
    expect(result.errors).toEqual([])
  })

  it('acepta 6-4, 4-6, 0-1 en «2 de 3 sets»', () => {
    const result = validateBestOf3Score(
      [
        { a: 6, b: 4 },
        { a: 4, b: 6 },
        { a: 0, b: 1 },
      ],
      bo3Opts,
    )
    expect(result.ok).toBe(true)
    expect(result.winner).toBe('b')
  })

  it('acepta 6-4, 4-6, 6-2 en «2 de 3 sets»', () => {
    const result = validateBestOf3Score(
      [
        { a: 6, b: 4 },
        { a: 4, b: 6 },
        { a: 6, b: 2 },
      ],
      bo3Opts,
    )
    expect(result.ok).toBe(true)
    expect(result.winner).toBe('a')
  })

  it('sigue aceptando set 3 clásico (6-4) cuando allowShortDecisiveSet está activo', () => {
    const result = validateBestOf3Score(
      [
        { a: 6, b: 4 },
        { a: 4, b: 6 },
        { a: 6, b: 4 },
      ],
      bo3Opts,
    )
    expect(result.ok).toBe(true)
    expect(result.winner).toBe('a')
  })

  it('rechaza 1-0 en set 3 si allowShortDecisiveSet está desactivado', () => {
    const result = validateBestOf3Score(
      [
        { a: 6, b: 4 },
        { a: 4, b: 6 },
        { a: 1, b: 0 },
      ],
      { gamesPerSet: 6 },
    )
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
