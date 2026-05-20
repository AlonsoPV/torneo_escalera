import { supabase } from '@/lib/supabase'
import type { StaffMatchNotification } from '@/types/database'

const PAGE_SIZE = 50

export async function listStaffMatchNotifications(limit = PAGE_SIZE): Promise<StaffMatchNotification[]> {
  const { data, error } = await supabase
    .from('staff_match_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))

  if (error) throw error
  return (data ?? []) as StaffMatchNotification[]
}

/** Solo refutaciones (`player_match_disputed`) para la bandeja admin de disputas. */
export async function listStaffDisputeNotifications(limit = PAGE_SIZE): Promise<StaffMatchNotification[]> {
  const { data, error } = await supabase
    .from('staff_match_notifications')
    .select('*')
    .eq('event_type', 'player_match_disputed')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))

  if (error) throw error
  return (data ?? []) as StaffMatchNotification[]
}
