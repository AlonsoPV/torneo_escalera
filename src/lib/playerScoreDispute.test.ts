import { describe, expect, it } from 'vitest'

import {
  PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH,
  PLAYER_SCORE_DISPUTE_REASON_MIN_LENGTH,
  validatePlayerScoreDisputeReason,
} from '@/lib/playerScoreDispute'

describe('validatePlayerScoreDisputeReason', () => {
  it('rechaza motivo corto (sync con RPC trim + length)', () => {
    expect(validatePlayerScoreDisputeReason('').ok).toBe(false)
    expect(validatePlayerScoreDisputeReason('  ab ').ok).toBe(false)
    expect(validatePlayerScoreDisputeReason('ab').ok).toBe(false)
  })

  it('acepta trim y mínimo', () => {
    const r = validatePlayerScoreDisputeReason('  abc  ')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reason).toBe('abc')
  })

  it('rechaza por exceso de longitud', () => {
    const tooLong = 'x'.repeat(PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH + 1)
    expect(validatePlayerScoreDisputeReason(tooLong).ok).toBe(false)
    const okLen = 'x'.repeat(PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH)
    expect(validatePlayerScoreDisputeReason(okLen).ok).toBe(true)
  })

  it('expone constantes alineadas con la UI', () => {
    expect(PLAYER_SCORE_DISPUTE_REASON_MIN_LENGTH).toBe(3)
    expect(PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH).toBeGreaterThan(100)
  })
})
