import { IMPORT_PENALTY_RANKING_POINTS } from '@/lib/matchResultSemantics'
import type { TournamentRules } from '@/types/database'

/**
 * Valores oficiales por defecto del producto (editable en BD por torneo).
 * `woWinPoints` / `woLossPoints` mapean a `points_default_win` / `points_default_loss` (W.O., DEF, default_win_*).
 */
export const TOURNAMENT_RULES = {
  winPoints: 3,
  lossPoints: 1,
  /** W.O. / DEF / default_win_* cuando la fila en BD no redefine valores. */
  woWinPoints: 3,
  woLossPoints: -1,
  doublePenaltyPoints: IMPORT_PENALTY_RANKING_POINTS,
} as const

export type RankingPointsRulesInput = Pick<
  TournamentRules,
  'points_per_win' | 'points_per_loss' | 'points_default_win' | 'points_default_loss'
>

export type ResolvedRankingPoints = {
  normalWin: number
  normalLoss: number
  defaultWin: number
  defaultLoss: number
  penaltyBoth: number
}

/**
 * Resuelve puntos para tabla de grupo: corrige `points_per_loss === 0` (legacy) a +1 partido jugado.
 */
export function resolveRankingPointsRules(rules: RankingPointsRulesInput): ResolvedRankingPoints {
  const pl = rules.points_per_loss
  const normalLoss =
    pl === 0 ? TOURNAMENT_RULES.lossPoints : (pl ?? TOURNAMENT_RULES.lossPoints)

  return {
    normalWin: rules.points_per_win ?? TOURNAMENT_RULES.winPoints,
    normalLoss,
    defaultWin: rules.points_default_win ?? TOURNAMENT_RULES.woWinPoints,
    defaultLoss: rules.points_default_loss ?? TOURNAMENT_RULES.woLossPoints,
    penaltyBoth: TOURNAMENT_RULES.doublePenaltyPoints,
  }
}
