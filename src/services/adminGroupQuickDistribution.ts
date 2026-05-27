import type { Profile } from '@/types/database'

import type { AdminGroupRecord } from '@/services/admin'
import { addGroupPlayer, createGroup, listGroupPlayers } from '@/services/groups'
import { generateRoundRobinForTournamentGroups } from '@/services/matches'

const DEFAULT_GROUP_MAX = 5

/** Igual que en vistas admin: orden estable para priorizar mismos orden_index / nombre. */
export function sortAdminGroupsForDistribution(a: AdminGroupRecord, b: AdminGroupRecord): number {
  return (
    (a.order_index ?? 0) - (b.order_index ?? 0) ||
    a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' })
  )
}

export function profileLabelForDistribution(p: Pick<Profile, 'full_name' | 'email' | 'phone'>): string {
  return p.full_name?.trim() || p.email?.trim() || p.phone?.trim() || 'Jugador'
}

/** Trocea el pool para grupos nuevos (hasta cupo típico; tramos vacíos los filtra quien llame). */
export function chunkProfilesForNewGroups<T>(rows: readonly T[], maxPerGroup = DEFAULT_GROUP_MAX): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += maxPerGroup) {
    chunks.push(rows.slice(i, i + maxPerGroup))
  }
  return chunks
}

/**
 * Rellena huecos en grupos incompletos usando una cola de perfiles ordenada (jugadores sin grupo).
 */
export async function bulkAssignPlayersToIncompleteGroups(opts: {
  incompleteGroupsSorted: readonly AdminGroupRecord[]
  queue: Profile[]
  label: (profile: Profile) => string
}): Promise<{ assigned: number }> {
  let assigned = 0
  const local = [...opts.queue]

  for (const group of opts.incompleteGroupsSorted) {
    const cap = group.max_players ?? DEFAULT_GROUP_MAX
    let nextSeed = group.players.length
    while (nextSeed < cap && local.length > 0) {
      const profile = local.shift()
      if (!profile) break
      await addGroupPlayer({
        groupId: group.id,
        userId: profile.id,
        displayName: opts.label(profile),
        seedOrder: nextSeed,
      })
      nextSeed += 1
      assigned += 1
    }
  }

  return { assigned }
}

/**
 * Crea grupos con jugadores y completa cruces RR en una pasada equivalente al card masivo
 * (`generateRoundRobinForTournamentGroups`, modo `fill`, alcance `all_eligible`).
 */
export async function bulkCreateNamedGroupsFromPlayerPool(opts: {
  tournamentId: string
  startingGroupTitleNumber: number
  startingOrderIndex: number
  freePlayers: Profile[]
  label: (profile: Profile) => string
  createdBy: string | null
}): Promise<{
  createdGroups: number
  assignedPlayers: number
  roundRobinMatchesInserted: number
}> {
  const chunks = chunkProfilesForNewGroups(opts.freePlayers, DEFAULT_GROUP_MAX).filter((chunk) => chunk.length >= 2)

  if (chunks.length === 0) {
    throw new Error('No hay suficientes jugadores libres para crear grupos con partidos.')
  }

  const bundlesForRr: {
    id: string
    name: string
    tournament_id: string
    max_players: number
    players: Awaited<ReturnType<typeof listGroupPlayers>>
  }[] = []

  let assignedPlayers = 0
  let titleNum = opts.startingGroupTitleNumber
  let orderIdx = opts.startingOrderIndex

  for (const players of chunks) {
    const group = await createGroup({
      tournamentId: opts.tournamentId,
      name: `Grupo ${titleNum}`,
      orderIndex: orderIdx,
      groupCategoryId: null,
      maxPlayers: DEFAULT_GROUP_MAX,
    })
    titleNum += 1
    orderIdx += 1

    for (const [seed, profile] of players.entries()) {
      await addGroupPlayer({
        groupId: group.id,
        userId: profile.id,
        displayName: opts.label(profile),
        seedOrder: seed,
      })
      assignedPlayers += 1
    }

    bundlesForRr.push({
      id: group.id,
      name: group.name,
      tournament_id: group.tournament_id,
      max_players: group.max_players ?? DEFAULT_GROUP_MAX,
      players: await listGroupPlayers(group.id),
    })
  }

  const rrResults = await generateRoundRobinForTournamentGroups({
    tournamentId: opts.tournamentId,
    mode: 'fill',
    scope: 'all_eligible',
    createdBy: opts.createdBy,
    groups: bundlesForRr,
  })

  const roundRobinMatchesInserted = rrResults.reduce((sum, r) => sum + (r.matchesInserted ?? 0), 0)

  return {
    createdGroups: bundlesForRr.length,
    assignedPlayers,
    roundRobinMatchesInserted,
  }
}

export { DEFAULT_GROUP_MAX }
