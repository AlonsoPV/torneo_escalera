import { supabase } from '@/lib/supabase'
import type { Group, GroupPlayer } from '@/types/database'

export async function listGroups(tournamentId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createGroup(input: {
  tournamentId: string
  name: string
  orderIndex?: number
}): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({
      tournament_id: input.tournamentId,
      name: input.name,
      order_index: input.orderIndex ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Group
}

export async function listGroupPlayers(groupId: string): Promise<GroupPlayer[]> {
  const { data, error } = await supabase
    .from('group_players')
    .select('*')
    .eq('group_id', groupId)
    .order('seed_order', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data ?? []
}

export type GroupMembership = {
  group: Group
  membership: GroupPlayer
}

/**
 * Inscripción del usuario en un torneo (como mucho un grupo activo por torneo en el MVP).
 */
export async function findGroupPlayerInTournament(
  userId: string,
  tournamentId: string,
): Promise<GroupMembership | null> {
  const { data, error } = await supabase
    .from('group_players')
    .select('id, user_id, group_id, display_name, seed_order, created_at, group:groups(*)')
    .eq('user_id', userId)
  if (error) throw error
  for (const row of data ?? []) {
    const raw = (row as { group?: Group | Group[] | null }).group
    const g = (Array.isArray(raw) ? raw[0] : raw) as Group | null | undefined
    if (g && g.tournament_id === tournamentId) {
      const membership: GroupPlayer = {
        id: row.id,
        user_id: row.user_id,
        group_id: row.group_id,
        display_name: row.display_name,
        seed_order: row.seed_order,
        created_at: row.created_at,
      }
      return { group: g, membership }
    }
  }
  return null
}

export async function addGroupPlayer(input: {
  groupId: string
  userId: string
  displayName: string
  seedOrder?: number
}): Promise<GroupPlayer> {
  const { data, error } = await supabase
    .from('group_players')
    .insert({
      group_id: input.groupId,
      user_id: input.userId,
      display_name: input.displayName,
      seed_order: input.seedOrder ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as GroupPlayer
}

export async function updateGroupPlayerSeed(
  id: string,
  seedOrder: number,
): Promise<void> {
  const { error } = await supabase
    .from('group_players')
    .update({ seed_order: seedOrder })
    .eq('id', id)
  if (error) throw error
}

export async function removeGroupPlayer(id: string): Promise<void> {
  const { error } = await supabase.from('group_players').delete().eq('id', id)
  if (error) throw error
}
