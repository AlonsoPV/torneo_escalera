import type { MatchRow, ScorePayload, ScoreSet, ScoreWinnerSide, TournamentRules } from '@/types/database'

import { validateTennisScore } from '@/lib/tournamentRulesEngine'

export function invertScoreSets(sets: ScoreSet[]): ScoreSet[] {
  return sets.map((s) => ({ a: s.b, b: s.a }))
}

export function setsWonForA(sets: ScoreSet[]): number {
  return sets.filter((s) => s.a > s.b).length
}

export function setsWonForB(sets: ScoreSet[]): number {
  return sets.filter((s) => s.b > s.a).length
}

export function computeWinnerGroupPlayerId(
  sets: ScoreSet[],
  playerAId: string,
  playerBId: string,
  bestOf: number,
): string | null {
  if (sets.length === 0) return null
  const need = Math.floor(bestOf / 2) + 1
  const aWins = setsWonForA(sets)
  const bWins = setsWonForB(sets)
  if (aWins >= need) return playerAId
  if (bWins >= need) return playerBId
  return null
}

/**
 * Formato `a-b` por set. En la matriz y en «mis resultados», pasa sets ya en
 * perspectiva del jugador que mira (`perspectiveSetsForCell` / `perspectiveScoreSetsForRowPlayer`)
 * para que el primer número sea siempre el suyo.
 */
export function formatScoreCompact(sets: ScoreSet[]): string {
  if (sets.length === 0) return '—'
  return sets.map((s) => `${s.a}-${s.b}`).join(', ')
}

export function getSetWinner(set: ScoreSet): ScoreWinnerSide | null {
  if (!Number.isInteger(set.a) || !Number.isInteger(set.b)) return null
  if (set.a < 0 || set.b < 0 || set.a === set.b) return null
  return set.a > set.b ? 'a' : 'b'
}

export function getSetsWon(scoreSets: ScoreSet[]): { a: number; b: number } {
  return scoreSets.reduce(
    (acc, set) => {
      const winner = getSetWinner(set)
      if (winner) acc[winner] += 1
      return acc
    },
    { a: 0, b: 0 },
  )
}

export function isMatchDecidedAfterTwoSets(scoreSets: ScoreSet[]): boolean {
  if (scoreSets.length < 2) return false
  const won = getSetsWon(scoreSets.slice(0, 2))
  return won.a === 2 || won.b === 2
}

export function shouldShowThirdSet(scoreSets: ScoreSet[]): boolean {
  if (scoreSets.length < 2) return false
  if (isMatchDecidedAfterTwoSets(scoreSets)) return false
  const won = getSetsWon(scoreSets.slice(0, 2))
  return won.a === 1 && won.b === 1
}

function validateNormalSet(set: ScoreSet): string | null {
  if (!Number.isInteger(set.a) || !Number.isInteger(set.b) || set.a < 0 || set.b < 0) {
    return 'Cada set debe tener games enteros mayores o iguales a 0.'
  }
  if (set.a === set.b) return 'Un set no puede terminar empatado.'

  const max = Math.max(set.a, set.b)
  const min = Math.min(set.a, set.b)
  if (max === 6 && min <= 4) return null
  if (max === 7 && (min === 5 || min === 6)) return null
  return `Set inválido: ${set.a}-${set.b}. Usa 6-0 a 6-4, 7-5 o 7-6.`
}

export function validateBestOf3Score(scoreSets: ScoreSet[]): {
  ok: boolean
  errors: string[]
  winner: ScoreWinnerSide | null
} {
  const sets = scoreSets.filter((set) => Number.isFinite(set.a) && Number.isFinite(set.b))
  const errors: string[] = []
  if (sets.length < 2) errors.push('Captura al menos 2 sets.')
  if (sets.length > 3) errors.push('Máximo 3 sets.')

  for (const set of sets) {
    const error = validateNormalSet(set)
    if (error) errors.push(error)
  }

  if (sets.length >= 3 && isMatchDecidedAfterTwoSets(sets)) {
    errors.push('El partido ya se definió en 2 sets. No captures tercer set.')
  }

  const firstTwoWon = getSetsWon(sets.slice(0, 2))
  if (sets.length === 2 && firstTwoWon.a === 1 && firstTwoWon.b === 1) {
    errors.push('Van 1-1 en sets. El tercer set es obligatorio.')
  }

  const won = getSetsWon(sets)
  const winner = won.a === 2 && won.b < 2 ? 'a' : won.b === 2 && won.a < 2 ? 'b' : null
  if (!winner && sets.length >= 2) {
    errors.push('El marcador debe definir un ganador con exactamente 2 sets ganados.')
  }

  return { ok: errors.length === 0 && winner != null, errors, winner }
}

export function validateSuddenDeathScore(result: { game_type: string; winner: string | null }): {
  ok: boolean
  errors: string[]
  winner: ScoreWinnerSide | null
} {
  if (result.game_type !== 'sudden_death') {
    return { ok: false, errors: ['Tipo de juego inválido.'], winner: null }
  }
  if (result.winner !== 'a' && result.winner !== 'b') {
    return { ok: false, errors: ['Selecciona quién ganó la muerte súbita.'], winner: null }
  }
  return { ok: true, errors: [], winner: result.winner }
}

export function getLongSetWinner(set: ScoreSet): ScoreWinnerSide | null {
  if (!Number.isInteger(set.a) || !Number.isInteger(set.b)) return null
  if (set.a < 0 || set.b < 0 || set.a === set.b) return null
  if (Math.abs(set.a - set.b) < 2) return null
  return set.a > set.b ? 'a' : 'b'
}

export function validateLongSetScore(set: ScoreSet): {
  ok: boolean
  errors: string[]
  winner: ScoreWinnerSide | null
} {
  const errors: string[] = []
  if (!Number.isInteger(set.a) || !Number.isInteger(set.b) || set.a < 0 || set.b < 0) {
    errors.push('El set largo solo acepta games enteros mayores o iguales a 0.')
  }
  if (set.a === set.b) errors.push('El set largo no puede terminar empatado.')
  if (Math.abs(set.a - set.b) < 2) errors.push('El ganador debe superar al rival por diferencia mínima de 2 games.')

  const winner = getLongSetWinner(set)
  return { ok: errors.length === 0 && winner != null, errors, winner }
}

export function winnerSideToGroupPlayerId(
  winner: ScoreWinnerSide,
  match: Pick<MatchRow, 'player_a_id' | 'player_b_id'>,
): string {
  return winner === 'a' ? match.player_a_id : match.player_b_id
}

export function scorePayloadToSets(payload: ScorePayload): ScoreSet[] {
  return payload.score_json ?? []
}

export function formatScoreForDisplay(match: MatchRow, perspectivePlayerId?: string | null): string {
  if (match.game_type === 'sudden_death') {
    if (!perspectivePlayerId || !match.winner_id) return 'Muerte súbita'
    return match.winner_id === perspectivePlayerId ? 'MS · Ganó' : 'MS · Perdió'
  }

  const sets = match.score_raw ?? []
  if (!sets.length) return '—'
  const perspectiveSets = perspectivePlayerId === match.player_b_id ? invertScoreSets(sets) : sets
  return formatScoreCompact(perspectiveSets)
}

export type ScoreValidationIssue = { code: string; message: string }

export function validateScoreWithRules(
  score: ScoreSet[],
  rules: TournamentRules,
): { ok: boolean; errors: string[]; issues: ScoreValidationIssue[] } {
  const result = validateTennisScore(score, rules)
  return {
    ok: result.ok,
    errors: result.errors,
    issues: result.errors.map((message) => ({ code: 'rules', message })),
  }
}

export function validateScoreAgainstRules(
  sets: ScoreSet[],
  rules: Pick<
    TournamentRules,
    'best_of_sets' | 'set_points' | 'tiebreak_enabled'
  >,
): ScoreValidationIssue[] {
  const issues: ScoreValidationIssue[] = []
  const maxSets = rules.best_of_sets

  if (sets.length === 0) {
    issues.push({ code: 'empty', message: 'Agrega al menos un set.' })
    return issues
  }
  if (sets.length > maxSets) {
    issues.push({
      code: 'too_many_sets',
      message: `Máximo ${maxSets} sets según el torneo.`,
    })
  }

  const need = Math.floor(maxSets / 2) + 1
  let aWins = 0
  let bWins = 0

  for (const s of sets) {
    if (!Number.isFinite(s.a) || !Number.isFinite(s.b)) {
      issues.push({
        code: 'nan',
        message: 'Cada set debe tener valores numéricos válidos.',
      })
      continue
    }
    if (s.a < 0 || s.b < 0) {
      issues.push({
        code: 'negative',
        message: 'Los games no pueden ser negativos.',
      })
    }
    if (s.a === s.b) {
      issues.push({
        code: 'tie',
        message: 'Un set no puede terminar empatado (debe haber un ganador del set).',
      })
    }
    const max = Math.max(s.a, s.b)
    const min = Math.min(s.a, s.b)
    if (max > rules.set_points) {
      const isStandardWin = max === rules.set_points && max - min >= 2
      const isTiebreakWin =
        rules.tiebreak_enabled &&
        max === rules.set_points + 1 &&
        min === rules.set_points
      if (!isStandardWin && !isTiebreakWin) {
        issues.push({
          code: 'set_score',
          message: `Set inválido para jugar a ${rules.set_points} games (tiebreak simplificado: ${rules.set_points}-${rules.set_points + 1}).`,
        })
      }
    }
    if (s.a > s.b) aWins++
    else if (s.b > s.a) bWins++
  }

  if (aWins < need && bWins < need) {
    issues.push({
      code: 'unfinished',
      message: 'El marcador no define un ganador según el formato del torneo.',
    })
  }

  return issues
}
