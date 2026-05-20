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

/** Un set a games según reglas del torneo (no formato corto decisivo). */
export function validateTournamentGamesSet(set: ScoreSet, rules: TournamentRules): string | null {
  const games = gamesPerSet(rules)
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

function validateSuddenSet(a: number, b: number, _sdp: number): string | null {
  void _sdp
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return 'El set decisivo debe tener valores enteros.'
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
  const sdp = rules.sudden_death_points ?? 10

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
    const err = useShort ? validateSuddenSet(a, b, sdp) : validateGamesSet(a, b, games, minDiff, tbOn, tbAt)
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
