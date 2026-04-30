import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'
import type { Tournament, TournamentRules, TournamentStatus } from '@/types/database'

const DEFAULT_RANKING_CRITERIA: Json = [
  { id: 'points', label: 'Puntos', enabled: true },
  { id: 'wins', label: 'Partidos ganados', enabled: true },
  { id: 'set_diff', label: 'Diferencia de sets', enabled: true },
  { id: 'game_diff', label: 'Diferencia de games', enabled: true },
  { id: 'h2h', label: 'Enfrentamiento directo', enabled: true },
]

export async function listTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createTournament(input: {
  name: string
  description?: string
  category?: string
  season?: string
  status?: TournamentStatus
  createdBy: string
}): Promise<Tournament> {
  const { count, error: openError } = await supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'finished')
  if (openError) throw openError
  if ((count ?? 0) > 0) {
    throw new Error('Ya existe un torneo activo o en borrador. Ciérralo antes de crear otro.')
  }

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name: input.name,
      description: input.description ?? null,
      category: input.category ?? null,
      season: input.season ?? null,
      status: input.status ?? 'draft',
      created_by: input.createdBy,
    })
    .select('*')
    .single()
  if (error) throw error
  const tournament = data as Tournament

  const { error: rulesError } = await supabase.from('tournament_rules').insert({
    tournament_id: tournament.id,
  })
  if (rulesError) throw rulesError

  return tournament
}

export async function updateTournament(
  id: string,
  patch: Partial<
    Pick<Tournament, 'name' | 'description' | 'category' | 'status' | 'season'>
  >,
): Promise<void> {
  const { error } = await supabase.from('tournaments').update(patch).eq('id', id)
  if (error) throw error
}

export async function getTournamentRules(
  tournamentId: string,
): Promise<TournamentRules | null> {
  const { data, error } = await supabase
    .from('tournament_rules')
    .select('*')
    .eq('tournament_id', tournamentId)
    .maybeSingle()
  if (error) throw error
  return data
}

export type TournamentRulesUpdatePayload = Partial<
  Pick<
    TournamentRules,
    | 'best_of_sets'
    | 'set_points'
    | 'tiebreak_enabled'
    | 'super_tiebreak_final_set'
    | 'points_per_win'
    | 'points_per_loss'
    | 'points_default_win'
    | 'points_default_loss'
    | 'allow_player_score_entry'
    | 'tiebreak_criteria'
    | 'updated_by'
    | 'defaults_enabled'
    | 'default_requires_admin_review'
    | 'player_can_report_default'
    | 'admin_can_set_default_manual'
    | 'result_submission_window_hours'
    | 'auto_penalty_no_show'
    | 'allow_7_6'
    | 'allow_7_5'
    | 'ranking_criteria'
    | 'match_format'
    | 'set_type'
    | 'games_per_set'
    | 'min_game_difference'
    | 'tiebreak_at'
    | 'final_set_format'
    | 'sudden_death_points'
  >
>

export async function updateTournamentRules(tournamentId: string, patch: TournamentRulesUpdatePayload): Promise<void> {
  const { error } = await supabase.from('tournament_rules').update(patch).eq('tournament_id', tournamentId)
  if (error) throw error
}

/** Restaura valores recomendados del producto (no borra la fila). */
export async function resetTournamentRulesToDefault(tournamentId: string): Promise<void> {
  const patch: TournamentRulesUpdatePayload = {
    best_of_sets: 3,
    set_points: 6,
    tiebreak_enabled: true,
    super_tiebreak_final_set: false,
    points_per_win: 3,
    points_per_loss: 1,
    points_default_win: 2,
    points_default_loss: -1,
    allow_player_score_entry: true,
    allow_7_6: true,
    allow_7_5: true,
    defaults_enabled: true,
    default_requires_admin_review: true,
    player_can_report_default: true,
    admin_can_set_default_manual: true,
    result_submission_window_hours: 48,
    auto_penalty_no_show: false,
    ranking_criteria: DEFAULT_RANKING_CRITERIA,
    updated_by: null,
    match_format: 'best_of_3',
    set_type: 'long_set',
    games_per_set: 6,
    min_game_difference: 2,
    tiebreak_at: 6,
    final_set_format: 'sudden_death',
    sudden_death_points: 10,
  }
  const { error } = await supabase.from('tournament_rules').update(patch).eq('tournament_id', tournamentId)
  if (error) throw error
}
