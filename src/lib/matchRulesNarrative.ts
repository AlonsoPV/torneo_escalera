import type { TournamentRulesFormValues } from '@/domain/tournamentRulesForm'

import {
  FINAL_SET_LABEL,
  MATCH_FORMAT_LABEL,
  SET_TYPE_LABEL,
  suddenDeathLabel,
  tiebreakAtLabel,
} from '@/lib/matchRulesLabels'

/** Párrafo en lenguaje claro para admins (vista previa). */
export function buildMatchRulesNarrative(values: TournamentRulesFormValues): string {
  const fmt = MATCH_FORMAT_LABEL[values.match_format] ?? values.match_format
  const st = SET_TYPE_LABEL[values.set_type] ?? values.set_type
  const games = values.games_per_set
  const diff = values.min_game_difference
  const tb = values.tiebreak_enabled
    ? `Tie-break activo (${tiebreakAtLabel(values.tiebreak_at, values.tiebreak_enabled).toLowerCase()}).`
    : 'Sin tie-break en sets alargados.'
  const final = FINAL_SET_LABEL[values.final_set_format] ?? values.final_set_format
  const sdp =
    values.final_set_format === 'sudden_death' || values.final_set_format === 'super_tiebreak'
      ? ` Si el partido llega al set decisivo, se juega como ${final.toLowerCase()} a ${suddenDeathLabel(values.sudden_death_points).toLowerCase()}.`
      : ` El set decisivo se juega como ${final.toLowerCase()}.`

  return `Los partidos se juegan a ${fmt.toLowerCase()}. Los sets normales son ${st.toLowerCase()} a ${games} games, con diferencia mínima de ${diff}. ${tb}${sdp}`
}

export function matchRulesValidExamples(): string[] {
  return ['6-3, 6-4', '6-4, 4-6, 10-8', '7-6, 6-3']
}

export function matchRulesInvalidExamples(): string[] {
  return ['6-5, 6-4 (falta diferencia en el primer set)', '6-3, 5-5 (set empatado)', '10-7 como primer set si solo aplica al decisivo']
}
