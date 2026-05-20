/** Alineado con `opponent_respond_match_score` (mín. 3 tras trim). */
export const PLAYER_SCORE_DISPUTE_REASON_MIN_LENGTH = 3

/** Límite de UI para evitar payloads absurdos; la columna es `text`. */
export const PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH = 2000

export type PlayerScoreDisputeReasonResult =
  | { ok: true; reason: string }
  | { ok: false; message: string }

export function validatePlayerScoreDisputeReason(raw: string): PlayerScoreDisputeReasonResult {
  const t = raw.trim()
  if (t.length < PLAYER_SCORE_DISPUTE_REASON_MIN_LENGTH) {
    return { ok: false, message: 'Describe el motivo de la refutación (mín. 3 caracteres).' }
  }
  if (t.length > PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH) {
    return {
      ok: false,
      message: `El motivo no puede superar ${PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH} caracteres.`,
    }
  }
  return { ok: true, reason: t }
}
