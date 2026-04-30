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
  groupCategoryId?: string | null
}): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({
      tournament_id: input.tournamentId,
      name: input.name,
      order_index: input.orderIndex ?? 0,
      group_category_id: input.groupCategoryId ?? null,
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

function mapGroupPlayerError(
  e: { message: string; code?: string; details?: string; hint?: string },
): string {
  const m = e.message
  if (m.includes('El jugador ya está inscrito') || m.includes('otro grupo')) return m
  if (m.includes('máximo') || m.includes('máx')) return m
  if (e.code === '23505') {
    return 'Ese usuario ya está en el grupo o duplicó la inscripción.'
  }
  return m
}

export async function addGroupPlayer(input: {
  groupId: string
  userId: string
  displayName: string
  seedOrder?: number
}): Promise<GroupPlayer> {
  const { data: g, error: gErr } = await supabase
    .from('groups')
    .select('id, max_players')
    .eq('id', input.groupId)
    .single()
  if (gErr) throw gErr
  const current = await listGroupPlayers(input.groupId)
  const cap = g?.max_players ?? 5
  if (current.length >= cap) {
    throw new Error(`El grupo alcanzó el máximo de ${cap} jugadores`)
  }
  if (current.some((p) => p.user_id === input.userId)) {
    throw new Error('Ese usuario ya está en el grupo')
  }
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
  if (error) throw new Error(mapGroupPlayerError(error))
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
