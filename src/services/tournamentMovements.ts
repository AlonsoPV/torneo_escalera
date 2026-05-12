import { isMissingPostgrestRelationError } from '@/lib/postgrestErrors'
import { supabase } from '@/lib/supabase'
import type { TournamentMovement } from '@/types/database'

export async function fetchLatestTournamentMovementForPlayer(input: {
  playerId: string
  toTournamentId: string
}): Promise<TournamentMovement | null> {
  const { data, error } = await supabase
    .from('tournament_movements')
    .select('*')
    .eq('player_id', input.playerId)
    .eq('to_tournament_id', input.toTournamentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    if (isMissingPostgrestRelationError(error)) return null
    throw error
  }
  return (data ?? null) as TournamentMovement | null
}
