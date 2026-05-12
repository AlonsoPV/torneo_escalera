import { supabase } from '@/lib/supabase'
import { generateMatchesForGroupIfComplete } from '@/services/matches'
import type { Group, GroupCategory, GroupPlayer } from '@/types/database'
import { generateGroupName } from '@/utils/nextTournamentPromotion'

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
  maxPlayers?: number
}): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({
      tournament_id: input.tournamentId,
      name: input.name,
      order_index: input.orderIndex ?? 0,
      max_players: input.maxPlayers ?? 5,
      group_category_id: input.groupCategoryId ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Group
}

/**
 * Crea un grupo por cada categoría del torneo que aún no tenga ningún grupo asignado.
 * Nombres: `{categoría} — Grupo 1` (alineado con el wizard de siguiente torneo).
 */
export async function createMissingGroupsOnePerCategory(input: {
  tournamentId: string
  categories: GroupCategory[]
  existingGroups: Pick<Group, 'order_index' | 'group_category_id'>[]
}): Promise<{ created: number }> {
  const sortedCats = [...input.categories].sort(
    (a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name, 'es'),
  )
  const groupCountByCategory = new Map<string, number>()
  for (const g of input.existingGroups) {
    if (!g.group_category_id) continue
    groupCountByCategory.set(
      g.group_category_id,
      (groupCountByCategory.get(g.group_category_id) ?? 0) + 1,
    )
  }

  let nextOrder =
    input.existingGroups.length === 0
      ? 0
      : Math.max(...input.existingGroups.map((g) => g.order_index), 0) + 1

  let created = 0
  for (const cat of sortedCats) {
    if ((groupCountByCategory.get(cat.id) ?? 0) > 0) continue
    await createGroup({
      tournamentId: input.tournamentId,
      name: generateGroupName(cat.name, 0),
      orderIndex: nextOrder,
      groupCategoryId: cat.id,
    })
    nextOrder += 1
    created += 1
  }

  return { created }
}

export type InitialGroupPayload = {
  name: string
  groupCategoryId?: string | null
  maxPlayers?: number
  orderIndex?: number
}

/**
 * Inserta varios grupos reales. Evita duplicar (torneo + categoría + nombre normalizado).
 */
export async function createGroupsForTournament(
  tournamentId: string,
  payloads: InitialGroupPayload[],
): Promise<Group[]> {
  if (!tournamentId.trim()) throw new Error('tournament_id requerido')
  if (payloads.length === 0) return []

  const existing = await listGroups(tournamentId)
  const dupKey = (name: string, cat: string | null) =>
    `${cat ?? 'none'}::${name.trim().toLowerCase()}`
  const taken = new Set(existing.map((g) => dupKey(g.name, g.group_category_id ?? null)))

  let nextOrder =
    existing.length === 0 ? 0 : Math.max(...existing.map((g) => g.order_index), 0) + 1

  const created: Group[] = []
  for (const p of payloads) {
    const rawName = p.name.trim()
    if (!rawName) throw new Error('Cada grupo requiere un nombre.')
    const cat = p.groupCategoryId ?? null
    const k = dupKey(rawName, cat)
    if (taken.has(k)) {
      throw new Error(`Ya existe un grupo «${rawName}» en esta categoría para el torneo.`)
    }
    taken.add(k)

    const orderIdx = p.orderIndex ?? nextOrder
    const g = await createGroup({
      tournamentId,
      name: rawName,
      orderIndex: orderIdx,
      groupCategoryId: cat,
      maxPlayers: p.maxPlayers ?? 5,
    })
    created.push(g)
    nextOrder = orderIdx + 1
  }

  return created
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
    .select('id, tournament_id, max_players')
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
  const inserted = data as GroupPlayer
  if (current.length + 1 === cap) {
    await generateMatchesForGroupIfComplete({ groupId: input.groupId, createdBy: input.userId })
  }
  return inserted
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

/** Elimina el grupo solo si no tiene jugadores inscritos. `matches` vacíos pueden eliminarse en cascada con el grupo. */
export async function deleteGroup(groupId: string): Promise<void> {
  const { count, error: countErr } = await supabase
    .from('group_players')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)
  if (countErr) throw countErr
  if ((count ?? 0) > 0) {
    throw new Error(
      'No puedes eliminar un grupo con jugadores inscritos. Quita primero a todos los jugadores del grupo.',
    )
  }
  const { error } = await supabase.from('groups').delete().eq('id', groupId)
  if (error) throw error
}
