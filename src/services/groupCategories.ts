import { isMissingPostgrestRelationError } from '@/lib/postgrestErrors'
import { supabase } from '@/lib/supabase'
import type { GroupCategory } from '@/types/database'

const DEFAULT_CATEGORIES: { name: string; order_index: number }[] = [
  { name: 'Primera División', order_index: 0 },
  { name: 'Liga de Ascenso', order_index: 1 },
  { name: 'Fuerzas básicas', order_index: 2 },
]

/** Inserta las tres categorías por defecto si el torneo aún no las tiene. */
export async function ensureDefaultGroupCategories(tournamentId: string): Promise<void> {
  const { data: existing, error: exErr } = await supabase
    .from('group_categories')
    .select('name')
    .eq('tournament_id', tournamentId)
  if (exErr) {
    if (isMissingPostgrestRelationError(exErr)) return
    throw exErr
  }
  const have = new Set((existing ?? []).map((r) => r.name))
  const rows = DEFAULT_CATEGORIES.filter((d) => !have.has(d.name)).map((d) => ({
    tournament_id: tournamentId,
    name: d.name,
    order_index: d.order_index,
  }))
  if (rows.length === 0) return
  const { error } = await supabase.from('group_categories').insert(rows)
  if (error) throw error
}

export async function listGroupCategories(tournamentId: string): Promise<GroupCategory[]> {
  const { data, error } = await supabase
    .from('group_categories')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('order_index', { ascending: true })
    .order('name', { ascending: true })
  if (error) {
    if (isMissingPostgrestRelationError(error)) return []
    throw error
  }
  return (data ?? []) as GroupCategory[]
}

export async function createGroupCategory(input: {
  tournamentId: string
  name: string
  orderIndex?: number
}): Promise<GroupCategory> {
  const { data, error } = await supabase
    .from('group_categories')
    .insert({
      tournament_id: input.tournamentId,
      name: input.name.trim(),
      order_index: input.orderIndex ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as GroupCategory
}

export async function updateGroupCategory(
  id: string,
  patch: Partial<Pick<GroupCategory, 'name' | 'order_index'>>,
): Promise<void> {
  const clean: Record<string, unknown> = {}
  if (patch.name !== undefined) clean.name = patch.name.trim()
  if (patch.order_index !== undefined) clean.order_index = patch.order_index
  if (Object.keys(clean).length === 0) return
  const { error } = await supabase.from('group_categories').update(clean).eq('id', id)
  if (error) throw error
}

export async function deleteGroupCategory(id: string): Promise<void> {
  const { error } = await supabase.from('group_categories').delete().eq('id', id)
  if (error) throw error
}
