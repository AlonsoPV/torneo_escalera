import type { ScoreSet } from '@/types/database'
import type { TournamentRules } from '@/types/database'

/**
 * Calcula puntos de ranking por partido según reglas del torneo.
 * TODO: Integrar con `matches.result_type` y pipeline de confirmación para unificar cálculo en backend.
 */
export function calculateMatchPoints(
  _match: { result_type?: string; winner_id?: string | null },
  _rules: Pick<TournamentRules, 'points_per_win' | 'points_per_loss' | 'points_default_win' | 'points_default_loss'>,
): { playerAPoints: number; playerBPoints: number } {
  void _match
  void _rules
  return { playerAPoints: 0, playerBPoints: 0 }
}

/**
 * TODO: Ordenar tabla de grupo con `ranking_criteria` y desempates.
 */
export function calculateStandings(
  _groupPlayers: unknown[],
  _matches: unknown[],
  _rules: TournamentRules,
): unknown[] {
  void _groupPlayers
  void _matches
  void _rules
  return []
}

export function maxSetsFromRules(rules: TournamentRules): number {
  const mf = rules.match_format
  if (mf === 'one_set') return 1
  if (mf === 'best_of_5') return 5
  if (mf === 'best_of_3') return 3
  return rules.best_of_sets ?? 3
}

export function gamesPerSet(rules: TournamentRules): number {
  return rules.games_per_set ?? rules.set_points
}

/**
 * Sets regulares a 6 games con tie-break a 6-6 (registrado siempre 7-6).
 * Resultados posibles: 7-6, 7-5 y 6-0 … 6-4 (ningún lado > 7 games).
 */
export function validateClassicSixGameSet(a: number, b: number): string | null {
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return 'Cada set debe tener games enteros.'
  }
  if (a < 0 || b < 0) return 'Los valores no pueden ser negativos.'
  if (a === b) return 'Un set no puede terminar empatado.'
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  if (hi > 7) return 'Ningún set puede superar 7 games.'
  if (hi === 7) {
    if (lo === 5 || lo === 6) return null
    return 'Si un set llega a 7 games, el rival debió tener 5 o 6 (7-5 o 7-6).'
  }
  if (hi === 6) {
    if (lo <= 4) return null
    return 'Con 6 games ganados, el rival puede tener como máximo 4 (6-0 … 6-4).'
  }
  return 'Marcador de set no válido (válidos: 6-0 … 6-4, 7-5, 7-6).'
}

/** Set decisivo por muerte súbita / super tie-break: siempre 1-0 al ganador (sin registrar puntos del mini break). */
export function validateDecisiveSuperTiebreakOneZero(set: ScoreSet): string | null {
  if (!Number.isInteger(set.a) || !Number.isInteger(set.b) || set.a < 0 || set.b < 0) {
    return 'El set decisivo solo acepta enteros ≥ 0.'
  }
  const ok = (set.a === 1 && set.b === 0) || (set.a === 0 && set.b === 1)
  if (!ok) {
    return 'El set decisivo (muerte súbita) se registra como 1-0 a favor del ganador.'
  }
  return null
}

/** Un set a games según reglas del torneo (no formato corto decisivo). */
export function validateTournamentGamesSet(set: ScoreSet, rules: TournamentRules): string | null {
  const games = gamesPerSet(rules)
  if (games === 6) return validateClassicSixGameSet(set.a, set.b)
  const minDiff = rules.min_game_difference ?? 2
  const tbAt = rules.tiebreak_at ?? null
  return validateGamesSet(set.a, set.b, games, minDiff, rules.tiebreak_enabled, tbAt)
}

/** Games por set: solo enteros no negativos y sin empate (sin formato ATP fijo). */
export function validateGamesSet(
  a: number,
  b: number,
  _games: number,
  _minDiff: number,
  _tbEnabled: boolean,
  _tbAt: number | null,
): string | null {
  void _games
  void _minDiff
  void _tbEnabled
  void _tbAt
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return 'Cada set debe tener games enteros.'
  }
  if (a < 0 || b < 0) return 'Los valores no pueden ser negativos'
  if (a === b) return 'Un set no puede terminar empatado'
  return null
}

/**
 * Valida marcador de tenis frente a reglas extendidas (`match_format`, `games_per_set`, etc.).
 * Alineado con `validate_match_score_against_tournament_rules` en Postgres.
 */
export function validateTennisScore(
  score: ScoreSet[],
  rules: TournamentRules,
  opts?: { winnerGroupPlayerId?: string | null; playerAId?: string; playerBId?: string },
): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!score?.length) {
    errors.push('Indica el marcador por sets')
    return { ok: false, errors }
  }

  const maxSets = maxSetsFromRules(rules)
  const need = Math.floor(maxSets / 2) + 1
  const games = gamesPerSet(rules)
  const minDiff = rules.min_game_difference ?? 2
  const tbOn = rules.tiebreak_enabled
  const tbAt = rules.tiebreak_at
  const finalFmt =
    rules.final_set_format ?? (rules.super_tiebreak_final_set ? ('super_tiebreak' as const) : ('sudden_death' as const))

  if (score.length > maxSets) {
    errors.push(`Máximo ${maxSets} sets según el torneo`)
  }

  let aWins = 0
  let bWins = 0

  for (let i = 0; i < score.length; i++) {
    const { a, b } = score[i]
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      errors.push('Cada set debe tener valores numéricos a y b')
      continue
    }
    const deciding = need > 1 && aWins === need - 1 && bWins === need - 1
    const useShort = deciding && (finalFmt === 'sudden_death' || finalFmt === 'super_tiebreak')
    let err: string | null
    if (useShort) {
      const shortErr = validateDecisiveSuperTiebreakOneZero(score[i])
      const classicErr =
        games === 6 ? validateClassicSixGameSet(a, b) : validateGamesSet(a, b, games, minDiff, tbOn, tbAt)
      err = shortErr && classicErr ? shortErr : null
    } else if (games === 6) {
      err = validateClassicSixGameSet(a, b)
    } else {
      err = validateGamesSet(a, b, games, minDiff, tbOn, tbAt)
    }
    if (err) errors.push(err)
    if (a > b) aWins += 1
    else if (b > a) bWins += 1
  }

  if (aWins < need && bWins < need) {
    errors.push('El marcador no define un ganador según el formato del torneo')
  }

  const wid = opts?.winnerGroupPlayerId
  const pa = opts?.playerAId
  const pb = opts?.playerBId
  if (wid && pa && pb) {
    const winner = aWins >= need ? pa : pb
    if (wid !== winner) {
      errors.push('El ganador no coincide con el marcador (sets)')
    }
  }

  return { ok: errors.length === 0, errors }
}

/** Fila de marcador que representa muerte súbita / super tie-break (puntos, no games). */
export function isSuddenDeathRowIndex(index: number, rules: TournamentRules): boolean {
  const ms = maxSetsFromRules(rules)
  const fmt =
    rules.final_set_format ??
    (rules.super_tiebreak_final_set ? ('super_tiebreak' as const) : ('sudden_death' as const))
  if (fmt !== 'sudden_death' && fmt !== 'super_tiebreak') return false
  if (ms === 3 && index === 2) return true
  if (ms === 5 && index === 4) return true
  return false
}
