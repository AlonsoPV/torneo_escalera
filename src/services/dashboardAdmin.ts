import { supabase } from '@/lib/supabase'

export type AdminDashboardStats = {
  tournamentCount: number
  activeTournamentCount: number
  groupCount: number
  matchCount: number
  pendingScoreCount: number
  resultSubmittedCount: number
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const t = await supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
  const act = await supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
  const g = await supabase
    .from('groups')
    .select('id', { count: 'exact', head: true })
  const m = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
  const pendingScore = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_score')
  const submitted = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .in('status', ['player_confirmed', 'score_disputed'])

  const e = t.error || act.error || g.error || m.error || pendingScore.error || submitted.error
  if (e) throw e
  return {
    tournamentCount: t.count ?? 0,
    activeTournamentCount: act.count ?? 0,
    groupCount: g.count ?? 0,
    matchCount: m.count ?? 0,
    pendingScoreCount: pendingScore.count ?? 0,
    resultSubmittedCount: submitted.count ?? 0,
  }
}
