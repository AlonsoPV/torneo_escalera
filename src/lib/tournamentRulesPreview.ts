import type { TournamentRulesFormValues } from '@/domain/tournamentRulesForm'

export type MatchPointsPreview = {
  winnerPts: number
  loserPts: number
}

export function previewNormalMatchPoints(rules: Pick<TournamentRulesFormValues, 'points_per_win' | 'points_per_loss'>): MatchPointsPreview {
  return { winnerPts: rules.points_per_win, loserPts: rules.points_per_loss }
}

export function previewDefaultMatchPoints(
  rules: Pick<TournamentRulesFormValues, 'points_default_win' | 'points_default_loss'>,
): MatchPointsPreview {
  return { winnerPts: rules.points_default_win, loserPts: rules.points_default_loss }
}
