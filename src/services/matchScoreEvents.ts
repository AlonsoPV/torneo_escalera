import { supabase } from '@/lib/supabase'
import type { MatchScoreLog } from '@/types/database'

export type MatchScoreEventName =
  | 'score_submitted'
  | 'score_accepted'
  | 'score_rejected'
  | 'score_resubmitted'
  | 'score_corrected_by_admin'
  | 'match_closed'
  | 'match_reopened'

export type MatchScoreEvent = MatchScoreLog & {
  eventName: MatchScoreEventName
  label: string
}

function eventNameForAction(action: string, nextStatus: string | null): MatchScoreEventName {
  if (action === 'opponent_accept') return 'score_accepted'
  if (action === 'opponent_reject') return 'score_rejected'
  if (action === 'player_resubmit_after_dispute') return 'score_resubmitted'
  if (action === 'admin_reopen') return 'match_reopened'
  if (action === 'match_validated') return 'match_closed'
  if (action === 'admin_score_corrected') return 'score_corrected_by_admin'
  if (action === 'player_disputed') return 'score_rejected'
  if (action === 'admin_update') {
    return nextStatus === 'closed' || nextStatus === 'validated' ? 'match_closed' : 'score_corrected_by_admin'
  }
  return 'score_submitted'
}

const labels: Record<MatchScoreEventName, string> = {
  score_submitted: 'Marcador confirmado para la tabla',
  score_accepted: 'Resultado confirmado por rival',
  score_rejected: 'Resultado refutado',
  score_resubmitted: 'Resultado corregido y reenviado',
  score_corrected_by_admin: 'Marcador corregido por admin',
  match_closed: 'Resultado cerrado',
  match_reopened: 'Resultado reabierto',
}

export async function listMatchScoreEvents(matchId: string): Promise<MatchScoreEvent[]> {
  const { data, error } = await supabase
    .from('match_score_logs')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return ((data ?? []) as MatchScoreLog[]).map((row) => {
    const eventName = eventNameForAction(row.action_type, row.new_status)
    return {
      ...row,
      eventName,
      label: labels[eventName],
    }
  })
}
