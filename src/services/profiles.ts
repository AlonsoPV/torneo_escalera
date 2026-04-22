import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types/database'

export async function listProfilesForAdmin(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function adminSetUserRole(
  userId: string,
  role: UserRole,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
  if (error) throw error
}
