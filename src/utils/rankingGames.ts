import {
  importResultTypeUsesDefaultPoints,
  syntheticAdministrativeSetsForDefaultMatch,
} from '@/lib/matchResultSemantics'
import type { MatchRow, ScoreSet } from '@/types/database'
import { validateSuddenDeathThirdSet } from '@/utils/score'

/** Diff de desempate: juegos a favor menos juegos en contra (JF − JC). */
export function computeRankingGamesDifference(gamesFor: number, gamesAgainst: number): number {
  return gamesFor - gamesAgainst
}

export function sumScoreSetGames(sets: ScoreSet[], forSideA: boolean): number {
  return sets.reduce((acc, s) => acc + (forSideA ? s.a : s.b), 0)
}

/**
 * Sets que entran al cómputo de JF / Diff en la tabla del grupo.
 *
 * - Bo3: todos los sets capturados.
 * - Set largo: solo el primer set.
 * - Muerte súbita sin marcador (solo ganador): 0 games, salvo marcador administrativo (DEF/WO).
 * - Muerte súbita histórica a 3 sets: los tres si el tercero es tie-break completo; solo el tercero si es 1-0.
 */
export function resolveScoreSetsForRankingStats(
  m: Pick<MatchRow, 'game_type' | 'score_raw' | 'result_type' | 'player_a_id' | 'player_b_id' | 'winner_id'>,
): ScoreSet[] {
  const raw = m.score_raw ?? []

  if (importResultTypeUsesDefaultPoints(m.result_type)) {
    const adminSets = syntheticAdministrativeSetsForDefaultMatch(m)
    return adminSets ?? (raw.length ? raw : [])
  }

  if (m.game_type === 'long_set') {
    return raw.length ? [raw[0]!] : []
  }

  if (m.game_type === 'sudden_death') {
    if (raw.length === 0) {
      return syntheticAdministrativeSetsForDefaultMatch(m) ?? []
    }
    if (raw.length === 1) return raw
    if (raw.length === 3 && validateSuddenDeathThirdSet(raw[2]!) === null) {
      return [raw[2]!]
    }
    if (raw.length >= 2) return raw
    return []
  }

  return raw.length ? raw : syntheticAdministrativeSetsForDefaultMatch(m) ?? []
}

export type RankingGamesStats = {
  gamesFor: number
  gamesAgainst: number
  gamesDifference: number
}

/** Normaliza JF/JC/Diff para preview o snapshot (Diff siempre derivado de JF − JC). */
export function normalizeRankingGamesStats(gamesFor: number, gamesAgainst: number): RankingGamesStats {
  return {
    gamesFor,
    gamesAgainst,
    gamesDifference: computeRankingGamesDifference(gamesFor, gamesAgainst),
  }
}
