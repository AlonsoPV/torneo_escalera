import { supabase } from '@/lib/supabase'
import type { Tournament, TournamentRules, TournamentStatus } from '@/types/database'

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

export async function updateTournamentRules(
  tournamentId: string,
  patch: Partial<
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
    >
  >,
): Promise<void> {
  const { error } = await supabase
    .from('tournament_rules')
    .update(patch)
    .eq('tournament_id', tournamentId)
  if (error) throw error
}
