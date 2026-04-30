import { supabase } from '@/lib/supabase'

export type AdminDashboardStats = {
  tournamentCount: number
  activeTournamentCount: number
  groupCount: number
  matchCount: number
  matchesWithoutEndTime: number
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
  const unsched = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .is('scheduled_end_at', null)
  const submitted = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .in('status', ['player_confirmed', 'score_disputed'])

  const e = t.error || act.error || g.error || m.error || unsched.error || submitted.error
  if (e) throw e
  return {
    tournamentCount: t.count ?? 0,
    activeTournamentCount: act.count ?? 0,
    groupCount: g.count ?? 0,
    matchCount: m.count ?? 0,
    matchesWithoutEndTime: unsched.count ?? 0,
    resultSubmittedCount: submitted.count ?? 0,
  }
}
