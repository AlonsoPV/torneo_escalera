import { z } from 'zod'

import type { Json } from '@/types/database'
import type { TournamentRules } from '@/types/database'
import type { TournamentRulesUpdatePayload } from '@/services/tournaments'

export const matchFormatIds = ['one_set', 'best_of_3', 'best_of_5'] as const
export type MatchFormatId = (typeof matchFormatIds)[number]

export const setTypeIds = ['long_set', 'short_set', 'tiebreak_set', 'pro_set'] as const
export type SetTypeId = (typeof setTypeIds)[number]

export const finalSetFormatIds = ['full_set', 'sudden_death', 'super_tiebreak', 'none'] as const
export type FinalSetFormatId = (typeof finalSetFormatIds)[number]

export const rankingCriterionIds = ['points', 'wins', 'set_diff', 'game_diff', 'h2h'] as const
export type RankingCriterionId = (typeof rankingCriterionIds)[number]

export type RankingCriterion = {
  id: RankingCriterionId
  label: string
  enabled: boolean
}

export const DEFAULT_RANKING_CRITERIA: RankingCriterion[] = [
  { id: 'points', label: 'Puntos', enabled: true },
  { id: 'wins', label: 'Partidos ganados', enabled: true },
  { id: 'set_diff', label: 'Diferencia de sets', enabled: true },
  { id: 'game_diff', label: 'Diferencia de games', enabled: true },
  { id: 'h2h', label: 'Enfrentamiento directo', enabled: true },
]

const rankingCriterionSchema = z.object({
  id: z.enum(rankingCriterionIds),
  label: z.string().min(1),
  enabled: z.boolean(),
})

function matchFormatFromBestOf(best: number | undefined | null): MatchFormatId {
  if (best === 1) return 'one_set'
  if (best === 5) return 'best_of_5'
  return 'best_of_3'
}

export const tournamentRulesFormSchema = z
  .object({
    match_format: z.enum(matchFormatIds),
    set_type: z.enum(setTypeIds),
    games_per_set: z.coerce.number().refine((n) => [4, 6, 8].includes(n), 'Elige 4, 6 u 8 games por set'),
    min_game_difference: z.union([z.literal(1), z.literal(2)]),
    tiebreak_enabled: z.boolean(),
    tiebreak_at: z.union([z.literal(5), z.literal(6)]).nullable(),
    final_set_format: z.enum(finalSetFormatIds),
    sudden_death_points: z.union([z.literal(7), z.literal(10)]),
    points_per_win: z.coerce.number().int().min(0),
    points_per_loss: z.coerce.number().int().min(-50),
    points_default_win: z.coerce.number().int().min(0),
    points_default_loss: z.coerce.number().int().min(-20).max(20),
    allow_player_score_entry: z.boolean(),
    allow_7_6: z.boolean(),
    allow_7_5: z.boolean(),
    defaults_enabled: z.boolean(),
    default_requires_admin_review: z.boolean(),
    player_can_report_default: z.boolean(),
    admin_can_set_default_manual: z.boolean(),
    result_submission_window_hours: z.coerce.number().int().min(1).max(720),
    auto_penalty_no_show: z.boolean(),
    ranking_criteria: z.array(rankingCriterionSchema).min(1),
    allowHighDefaultWinPoints: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.points_per_win <= data.points_per_loss) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Los puntos por victoria deben ser mayores que los de derrota (p. ej. 3 > 1 o 3 > −1).',
        path: ['points_per_win'],
      })
    }
    if (data.points_default_win > data.points_per_win && !data.allowHighDefaultWinPoints) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'La victoria por default no puede otorgar más puntos que una victoria normal, salvo que marques la casilla de confirmación.',
        path: ['points_default_win'],
      })
    }
    const enabledCount = data.ranking_criteria.filter((c) => c.enabled).length
    if (enabledCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Activa al menos un criterio de desempate.',
        path: ['ranking_criteria'],
      })
    }
    if (data.tiebreak_enabled && (data.tiebreak_at !== 5 && data.tiebreak_at !== 6)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indica en qué marcador entra el tie-break (6-6 o 5-5).',
        path: ['tiebreak_at'],
      })
    }
  })

export type TournamentRulesFormValues = z.infer<typeof tournamentRulesFormSchema>

export function parseRankingCriteria(raw: Json | null | undefined): RankingCriterion[] {
  if (!raw || !Array.isArray(raw)) return DEFAULT_RANKING_CRITERIA
  const out: RankingCriterion[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const id = rec.id
    if (typeof id !== 'string' || !rankingCriterionIds.includes(id as RankingCriterionId)) continue
    const label = typeof rec.label === 'string' ? rec.label : DEFAULT_RANKING_CRITERIA.find((d) => d.id === id)?.label ?? id
    const enabled = typeof rec.enabled === 'boolean' ? rec.enabled : true
    out.push({ id: id as RankingCriterionId, label, enabled })
  }
  const byId = new Map(out.map((c) => [c.id, c]))
  return DEFAULT_RANKING_CRITERIA.map((d) => byId.get(d.id) ?? d)
}

function parseMatchFormat(raw: string | null | undefined, bestOf: number | undefined): MatchFormatId {
  if (raw && matchFormatIds.includes(raw as MatchFormatId)) return raw as MatchFormatId
  return matchFormatFromBestOf(bestOf)
}

function parseSetType(raw: string | null | undefined): SetTypeId {
  if (raw && setTypeIds.includes(raw as SetTypeId)) return raw as SetTypeId
  return 'long_set'
}

function parseFinalSet(raw: string | null | undefined, superTb: boolean | undefined): FinalSetFormatId {
  if (raw && finalSetFormatIds.includes(raw as FinalSetFormatId)) return raw as FinalSetFormatId
  if (superTb) return 'super_tiebreak'
  return 'sudden_death'
}

export type TournamentRulesRowInput = Partial<TournamentRules> | null

function withDefaults(row: TournamentRulesRowInput): TournamentRulesFormValues {
  const base: Partial<TournamentRules> = row ?? {}
  const ranking = parseRankingCriteria(base.ranking_criteria ?? null)
  const win = base.points_per_win ?? 3
  const loss = base.points_per_loss ?? 1
  const defWin = base.points_default_win ?? 2
  const rawGames = base.games_per_set ?? base.set_points ?? 6
  const games = [4, 6, 8].includes(rawGames) ? rawGames : 6
  const tiebreakOn = base.tiebreak_enabled ?? true
  const tbAt = base.tiebreak_at ?? (tiebreakOn ? 6 : null)
  return {
    match_format: parseMatchFormat(base.match_format ?? null, base.best_of_sets),
    set_type: parseSetType(base.set_type ?? null),
    games_per_set: games,
    min_game_difference: (base.min_game_difference === 1 ? 1 : 2) as 1 | 2,
    tiebreak_enabled: tiebreakOn,
    tiebreak_at: tiebreakOn ? ((tbAt === 5 ? 5 : 6) as 5 | 6) : null,
    final_set_format: parseFinalSet(base.final_set_format ?? null, base.super_tiebreak_final_set),
    sudden_death_points: (base.sudden_death_points === 7 ? 7 : 10) as 7 | 10,
    points_per_win: win,
    points_per_loss: loss,
    points_default_win: defWin,
    points_default_loss: base.points_default_loss ?? -1,
    allow_player_score_entry: base.allow_player_score_entry ?? true,
    allow_7_6: base.allow_7_6 ?? true,
    allow_7_5: base.allow_7_5 ?? true,
    defaults_enabled: base.defaults_enabled ?? true,
    default_requires_admin_review: base.default_requires_admin_review ?? true,
    player_can_report_default: base.player_can_report_default ?? true,
    admin_can_set_default_manual: base.admin_can_set_default_manual ?? true,
    result_submission_window_hours: base.result_submission_window_hours ?? 48,
    auto_penalty_no_show: base.auto_penalty_no_show ?? false,
    ranking_criteria: ranking,
    allowHighDefaultWinPoints: defWin > win,
  }
}

export function rulesRowToFormValues(row: TournamentRulesRowInput): TournamentRulesFormValues {
  return withDefaults(row)
}

/** Payload persistible (solo columnas de `tournament_rules`; sin campos solo UI). */
export function formValuesToRulesUpdate(
  values: TournamentRulesFormValues,
  updatedBy: string | null,
): TournamentRulesUpdatePayload {
  const best_of_sets = values.match_format === 'one_set' ? 1 : values.match_format === 'best_of_5' ? 5 : 3
  const set_points = values.games_per_set
  const super_tiebreak_final_set = values.final_set_format === 'super_tiebreak'
  const tiebreak_at = values.tiebreak_enabled ? values.tiebreak_at : null

  return {
    match_format: values.match_format,
    set_type: values.set_type,
    games_per_set: values.games_per_set,
    min_game_difference: values.min_game_difference,
    tiebreak_enabled: values.tiebreak_enabled,
    tiebreak_at,
    final_set_format: values.final_set_format,
    sudden_death_points: values.sudden_death_points,
    points_per_win: values.points_per_win,
    points_per_loss: values.points_per_loss,
    points_default_win: values.points_default_win,
    points_default_loss: values.points_default_loss,
    allow_player_score_entry: values.allow_player_score_entry,
    allow_7_6: values.allow_7_6,
    allow_7_5: values.allow_7_5,
    defaults_enabled: values.defaults_enabled,
    default_requires_admin_review: values.default_requires_admin_review,
    player_can_report_default: values.player_can_report_default,
    admin_can_set_default_manual: values.admin_can_set_default_manual,
    result_submission_window_hours: values.result_submission_window_hours,
    auto_penalty_no_show: values.auto_penalty_no_show,
    ranking_criteria: values.ranking_criteria as unknown as Json,
    updated_by: updatedBy,
    best_of_sets,
    set_points,
    super_tiebreak_final_set,
  }
}

/** Construye un `TournamentRules` mínimo para validación de marcador / helpers desde el formulario. */
export function formValuesToMatchRulesTournament(values: TournamentRulesFormValues): TournamentRules {
  const best_of_sets = values.match_format === 'one_set' ? 1 : values.match_format === 'best_of_5' ? 5 : 3
  return {
    id: '',
    tournament_id: '',
    created_at: '',
    updated_at: '',
    best_of_sets,
    set_points: values.games_per_set,
    tiebreak_enabled: values.tiebreak_enabled,
    super_tiebreak_final_set: values.final_set_format === 'super_tiebreak',
    points_per_win: values.points_per_win,
    points_per_loss: values.points_per_loss,
    points_default_win: values.points_default_win,
    points_default_loss: values.points_default_loss,
    tiebreak_criteria: null,
    allow_player_score_entry: values.allow_player_score_entry,
    updated_by: null,
    defaults_enabled: values.defaults_enabled,
    default_requires_admin_review: values.default_requires_admin_review,
    player_can_report_default: values.player_can_report_default,
    admin_can_set_default_manual: values.admin_can_set_default_manual,
    result_submission_window_hours: values.result_submission_window_hours,
    auto_penalty_no_show: values.auto_penalty_no_show,
    allow_7_6: values.allow_7_6,
    allow_7_5: values.allow_7_5,
    ranking_criteria: values.ranking_criteria as unknown as Json,
    match_format: values.match_format,
    set_type: values.set_type,
    games_per_set: values.games_per_set,
    min_game_difference: values.min_game_difference,
    tiebreak_at: values.tiebreak_enabled ? values.tiebreak_at : null,
    final_set_format: values.final_set_format,
    sudden_death_points: values.sudden_death_points,
  }
}

export function validateRulesPayload(values: unknown) {
  return tournamentRulesFormSchema.safeParse(values)
}
