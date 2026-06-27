import type { MatchRow, ScorePayload, ScoreSet, ScoreWinnerSide, TournamentRules } from '@/types/database'

import {
  validateClassicSixGameSet,
  validateDecisiveSuperTiebreakOneZero,
  validateTennisScore,
  validateTournamentGamesSet,
} from '@/lib/tournamentRulesEngine'

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

export function totalGamesBySide(scoreSets: ScoreSet[]): { a: number; b: number } {
  return scoreSets.reduce(
    (acc, set) => {
      acc.a += Number.isFinite(set.a) ? set.a : 0
      acc.b += Number.isFinite(set.b) ? set.b : 0
      return acc
    },
    { a: 0, b: 0 },
  )
}

export function winnerSideByTotalGames(scoreSets: ScoreSet[]): ScoreWinnerSide | null {
  const games = totalGamesBySide(scoreSets)
  if (games.a > games.b) return 'a'
  if (games.b > games.a) return 'b'
  return null
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
  return null
}

/** Set flexible (import histórico / tie-break corto decisivo): solo entero, no negativo, sin empate. */
export function validateFlexibleBo3Set(set: ScoreSet): string | null {
  if (!Number.isInteger(set.a) || !Number.isInteger(set.b) || set.a < 0 || set.b < 0) {
    return 'Cada set debe tener números enteros ≥ 0.'
  }
  if (set.a === set.b) return 'Un set no puede terminar empatado.'
  return null
}

/** Carga CSV / histórico: solo enteros ≥ 0; permite empates por set y no exige formato ATP. */
export function validateImportLooseSet(set: ScoreSet): string | null {
  if (!Number.isInteger(set.a) || !Number.isInteger(set.b) || set.a < 0 || set.b < 0) {
    return 'Cada set debe tener números enteros ≥ 0.'
  }
  return null
}

export function validateIncompleteBestOf3Score(scoreSets: ScoreSet[]): {
  ok: boolean
  errors: string[]
  winnerByGames: ScoreWinnerSide | null
  games: { a: number; b: number }
} {
  const sets = scoreSets.filter((set) => Number.isFinite(set.a) && Number.isFinite(set.b))
  const errors: string[] = []
  if (sets.length < 1) errors.push('Captura al menos un set jugado o usa No reportado.')
  if (sets.length > 3) errors.push('Maximo 3 sets.')
  for (const set of sets) {
    const error = validateImportLooseSet(set)
    if (error) errors.push(error)
  }
  const games = totalGamesBySide(sets)
  if (games.a + games.b <= 0) errors.push('Para retiro debe existir al menos un game jugado.')
  return {
    ok: errors.length === 0,
    errors,
    winnerByGames: winnerSideByTotalGames(sets),
    games,
  }
}

/** «2 de 3 sets» y variante con super tie-break en el set decisivo. */
export function allowsShortDecisiveThirdSet(gameType: string): boolean {
  return gameType === 'best_of_3' || gameType === 'best_of_3_short_tiebreak'
}

export type ValidateBestOf3Options = {
  /** Tercer set 1-1: acepta 1-0 (super tie-break) además del formato clásico por games. */
  allowShortDecisiveSet?: boolean
  /** Reservado para compatibilidad; ya no cambia la validación del 3.er set corto. */
  shortDecisiveSetNoMinDifference?: boolean
  /** Games por set del torneo; con 6 se aplican marcadores clásicos (6-0…6-4, 7-5, 7-6). */
  gamesPerSet?: number
  /** Import histórico: acepta sets irregulares siempre que definan 2 sets ganados y sin empates por set. */
  historicalFlexibleSets?: boolean
  /**
   * Importación masiva CSV: omite reglas de «2 sets ganados», empates por set y formato de games.
   * Si `forcedWinnerSide` está definido, ese lado es el ganador aunque el marcador sea incompleto o irregular.
   */
  importCsvRelaxed?: boolean
  forcedWinnerSide?: ScoreWinnerSide
}

export function validateBestOf3Score(
  scoreSets: ScoreSet[],
  opts?: ValidateBestOf3Options,
): {
  ok: boolean
  errors: string[]
  winner: ScoreWinnerSide | null
} {
  const sets = scoreSets.filter((set) => Number.isFinite(set.a) && Number.isFinite(set.b))
  const errors: string[] = []

  const csvRelaxed = opts?.importCsvRelaxed === true
  const minSets = csvRelaxed && opts?.forcedWinnerSide ? 1 : 2

  if (sets.length < minSets) {
    errors.push(
      csvRelaxed && minSets === 1
        ? 'Captura al menos un set con números.'
        : 'Captura al menos 2 sets.',
    )
  }
  if (sets.length > 3) errors.push('Máximo 3 sets.')

  if (csvRelaxed) {
    for (const set of sets) {
      const error = validateImportLooseSet(set)
      if (error) errors.push(error)
    }
    let winner: ScoreWinnerSide | null = opts.forcedWinnerSide ?? null
    if (!winner) {
      const won = getSetsWon(sets)
      if (won.a === 2 && won.b < 2) winner = 'a'
      else if (won.b === 2 && won.a < 2) winner = 'b'
    }
    return { ok: errors.length === 0, errors, winner }
  }

  const flex = opts?.historicalFlexibleSets === true
  const gamesPs = opts?.gamesPerSet ?? 6

  if (flex) {
    for (const set of sets) {
      const error = validateFlexibleBo3Set(set)
      if (error) errors.push(error)
    }
  } else {
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i]
      const isThird = i === 2 && sets.length === 3
      const firstTwoSplit = getSetsWon(sets.slice(0, 2))
      const thirdAtOneOne = isThird && firstTwoSplit.a === 1 && firstTwoSplit.b === 1
      let error: string | null
      if (thirdAtOneOne && opts?.allowShortDecisiveSet === true) {
        const classicErr =
          gamesPs === 6 ? validateClassicSixGameSet(set.a, set.b) : validateNormalSet(set)
        const shortErr = validateDecisiveSuperTiebreakOneZero(set)
        error = classicErr && shortErr ? shortErr : null
      } else if (gamesPs === 6) {
        error = validateClassicSixGameSet(set.a, set.b)
      } else {
        error = validateNormalSet(set)
      }
      if (error) errors.push(error)
    }
  }

  if (!flex && sets.length >= 3 && isMatchDecidedAfterTwoSets(sets)) {
    errors.push('El partido ya se definió en 2 sets. No captures tercer set.')
  }

  const firstTwoWon = getSetsWon(sets.slice(0, 2))
  if (!flex && sets.length === 2 && firstTwoWon.a === 1 && firstTwoWon.b === 1) {
    errors.push('Van 1-1 en sets. El tercer set es obligatorio.')
  }

  const won = getSetsWon(sets)
  const winner = won.a === 2 && won.b < 2 ? 'a' : won.b === 2 && won.a < 2 ? 'b' : null
  if (!winner && sets.length >= 2) {
    errors.push('El marcador debe definir un ganador con exactamente 2 sets ganados.')
  }

  return { ok: errors.length === 0 && winner != null, errors, winner }
}

/** Set decisivo de muerte subita: enteros no negativos, sin empate. */
export function validateSuddenDeathThirdSet(set: ScoreSet): string | null {
  return validateDecisiveSuperTiebreakOneZero(set)
}

export function getSuddenDeathWinnerSide(sets: ScoreSet[]): ScoreWinnerSide | null {
  if (sets.length === 1) return getSetWinner(sets[0])
  if (sets.length < 3) return null
  return getSetWinner(sets[2])
}

export type ValidateSuddenDeathMatchScoreOptions = {
  /** Import histórico: sets 1-2 solo enteros, sin empate, sin formato ATP. */
  historicalFlexibleSets?: boolean
}

export function validateSuddenDeathMatchScore(
  sets: ScoreSet[],
  rules: TournamentRules | null,
  opts?: ValidateSuddenDeathMatchScoreOptions,
): { ok: boolean; errors: string[]; winner: ScoreWinnerSide | null } {
  const errors: string[] = []
  if (sets.length !== 1 && sets.length !== 3) {
    errors.push('La muerte subita debe capturar el set decisivo o los 3 sets historicos.')
    return { ok: false, errors, winner: null }
  }

  if (sets.length === 1) {
    const err = validateSuddenDeathThirdSet(sets[0])
    if (err) errors.push(err)
    const winner = errors.length === 0 ? getSetWinner(sets[0]) : null
    return { ok: errors.length === 0 && winner != null, errors, winner }
  }

  const flex = opts?.historicalFlexibleSets === true
  for (let i = 0; i < 2; i++) {
    const msg = flex
      ? validateFlexibleBo3Set(sets[i])
      : rules
        ? validateTournamentGamesSet(sets[i], rules)
        : validateNormalSet(sets[i])
    if (msg) errors.push(`Set ${i + 1}: ${msg}`)
  }

  const third = validateSuddenDeathThirdSet(sets[2])
  if (third) errors.push(third)

  const winner = errors.length === 0 ? getSuddenDeathWinnerSide(sets) : null
  return { ok: errors.length === 0 && winner != null, errors, winner }
}

export function validateSuddenDeathScore(input: {
  game_type: string
  score_json: ScoreSet[] | null
  winner: ScoreWinnerSide | null
  rules?: TournamentRules | null
  historicalFlexibleSets?: boolean
}): { ok: boolean; errors: string[]; winner: ScoreWinnerSide | null } {
  if (input.game_type !== 'sudden_death') {
    return { ok: false, errors: ['Tipo de juego inválido.'], winner: null }
  }

  const sj = input.score_json
  if (sj == null || sj.length === 0) {
    if (input.winner === 'a' || input.winner === 'b') {
      return { ok: true, errors: [], winner: input.winner }
    }
    return {
      ok: false,
      errors: ['Captura el set decisivo o indica el ganador (solo resultados sin marcador).'],
      winner: null,
    }
  }

  const v = validateSuddenDeathMatchScore(sj, input.rules ?? null, {
    historicalFlexibleSets: input.historicalFlexibleSets,
  })
  if (!v.ok || !v.winner) return v

  if (input.winner != null && input.winner !== v.winner) {
    return {
      ok: false,
      errors: ['El ganador no coincide con el set decisivo.'],
      winner: null,
    }
  }

  return { ok: true, errors: [], winner: v.winner }
}

/** Validación para sheet/modal con reglas de torneo (no usa validateTennisScore: el ganador no es por mayoría de sets). */
export function validateSuddenDeathScoreWithRules(
  sets: ScoreSet[],
  rules: TournamentRules,
): { ok: boolean; errors: string[]; winner: ScoreWinnerSide | null } {
  return validateSuddenDeathMatchScore(sets, rules)
}

export function getLongSetWinner(set: ScoreSet): ScoreWinnerSide | null {
  if (!Number.isInteger(set.a) || !Number.isInteger(set.b)) return null
  if (set.a < 0 || set.b < 0 || set.a === set.b) return null
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
  if (payload.game_type === 'sudden_death') return payload.score_json ?? []
  return payload.score_json ?? []
}

export function formatScoreForDisplay(match: MatchRow, perspectivePlayerId?: string | null): string {
  const sets = match.score_raw ?? []
  if (match.game_type === 'sudden_death') {
    if (sets.length > 0) {
      const perspectiveSets =
        perspectivePlayerId === match.player_b_id ? invertScoreSets(sets) : sets
      return formatScoreCompact(perspectiveSets)
    }
    if (!perspectivePlayerId || !match.winner_id) return 'Muerte súbita'
    return match.winner_id === perspectivePlayerId ? 'MS · Ganó' : 'MS · Perdió'
  }

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
