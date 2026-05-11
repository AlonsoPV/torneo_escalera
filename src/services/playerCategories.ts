import { supabase } from '@/lib/supabase'
import type { PlayerCategory } from '@/types/database'

export async function listPlayerCategories(): Promise<PlayerCategory[]> {
  const { data, error } = await supabase
    .from('player_categories')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as PlayerCategory[]
}

export async function createPlayerCategory(input: {
  name: string
  description?: string | null
}): Promise<PlayerCategory> {
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user?.id ?? null

  const { data, error } = await supabase
    .from('player_categories')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      created_by: uid,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as PlayerCategory
}
