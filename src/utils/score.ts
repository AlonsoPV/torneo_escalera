import type { ScoreSet, TournamentRules } from '@/types/database'

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

export type ScoreValidationIssue = { code: string; message: string }

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
    if (s.a < 0 || s.b < 0) {
      issues.push({
        code: 'negative',
        message: 'Los games no pueden ser negativos.',
      })
    }
    if (s.a === s.b) {
      issues.push({
        code: 'tie',
        message: 'Un set no puede terminar empatado.',
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
