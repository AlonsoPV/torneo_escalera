import { createGroup, listGroupPlayers, listGroups, updateGroup } from '@/services/groups'
import { createGroupCategory, listGroupCategories } from '@/services/groupCategories'
import { generateRoundRobinMatches, listMatchesForGroup } from '@/services/matches'
import {
  createTournamentForHistoricalImport,
  listTournaments,
  updateTournament,
} from '@/services/tournaments'
import type { Group, GroupCategory, Tournament } from '@/types/database'

function normKey(s: string): string {
  return s.trim().toLowerCase()
}

/** Vacío, «-» o sin categoría → grupo sin división */
export function normalizeImportCategoryName(raw: string): string | null {
  const t = raw.trim()
  if (!t || t === '-') return null
  const k = normKey(t)
  if (k === 'sin categoría' || k === 'sin categoria') return null
  return t
}

export type ImportStructureTriplet = {
  tournamentName: string
  categoryRaw: string
  groupName: string
}

export function collectImportStructureTriplets(rows: Record<string, string>[]): ImportStructureTriplet[] {
  const map = new Map<string, ImportStructureTriplet>()
  for (const cells of rows) {
    const tournamentName = String(cells.tournament_name ?? '').trim()
    const groupName = String(cells.group_name ?? '').trim()
    if (!tournamentName || !groupName) continue
    const categoryRaw = String(cells.category_name ?? '').trim()
    const key = `${normKey(tournamentName)}::${normKey(categoryRaw)}::${normKey(groupName)}`
    if (!map.has(key)) map.set(key, { tournamentName, categoryRaw, groupName })
  }
  return [...map.values()].sort(
    (a, b) =>
      normKey(a.tournamentName).localeCompare(normKey(b.tournamentName), 'es') ||
      normKey(a.categoryRaw).localeCompare(normKey(b.categoryRaw), 'es') ||
      normKey(a.groupName).localeCompare(normKey(b.groupName), 'es'),
  )
}

export type SyncMatchResultsImportStructureResult = {
  tournamentsTouched: string[]
  categoriesCreated: number
  groupsCreated: number
  /** Grupos ya existentes cuyo nombre o categoría se alinearon con el CSV. */
  groupsUpdated: number
  messages: string[]
}

async function ensureRoundRobinIfPossible(
  tournamentId: string,
  groupId: string,
  createdBy: string,
): Promise<void> {
  const players = await listGroupPlayers(groupId)
  if (players.length < 2) return
  const existing = await listMatchesForGroup(groupId)
  if (existing.length > 0) return
  await generateRoundRobinMatches({
    tournamentId,
    groupId,
    players,
    createdBy,
    mode: 'fill',
  })
}

/**
 * Crea o actualiza torneos, categorías de grupo y grupos según el CSV (antes de validar partidos).
 * - Torneo nuevo → `finished` (histórico).
 * - Torneo existente distinto del torneo **activo** actual → `finished` (+ `finished_at` si aplica).
 * - No altera el estado del torneo activo principal cuando coincide con la fila.
 */
export async function syncMatchResultsImportStructure(
  rows: Record<string, string>[],
  uploadedBy: string,
): Promise<SyncMatchResultsImportStructureResult> {
  const triplets = collectImportStructureTriplets(rows)
  const messages: string[] = []
  let categoriesCreated = 0
  let groupsCreated = 0
  let groupsUpdated = 0
  const tournamentsTouchedIds = new Set<string>()

  if (triplets.length === 0) {
    return { tournamentsTouched: [], categoriesCreated: 0, groupsCreated: 0, groupsUpdated: 0, messages: [] }
  }

  let tournaments = await listTournaments()
  const activeList = tournaments.filter((t) => t.status === 'active')
  const primaryActive = activeList[0] ?? null

  const catsByTournament = new Map<string, GroupCategory[]>()
  const groupsByTournament = new Map<string, Group[]>()

  async function loadCategories(tournamentId: string): Promise<GroupCategory[]> {
    if (!catsByTournament.has(tournamentId)) {
      catsByTournament.set(tournamentId, await listGroupCategories(tournamentId))
    }
    return catsByTournament.get(tournamentId)!
  }

  async function loadGroups(tournamentId: string): Promise<Group[]> {
    if (!groupsByTournament.has(tournamentId)) {
      groupsByTournament.set(tournamentId, await listGroups(tournamentId))
    }
    return groupsByTournament.get(tournamentId)!
  }

  async function refreshCategories(tournamentId: string) {
    catsByTournament.set(tournamentId, await listGroupCategories(tournamentId))
  }

  async function refreshGroups(tournamentId: string) {
    groupsByTournament.set(tournamentId, await listGroups(tournamentId))
  }

  function findTournamentByName(name: string): Tournament | undefined {
    const n = normKey(name)
    return tournaments.find((t) => normKey(t.name) === n)
  }

  async function resolveTournament(displayName: string): Promise<Tournament> {
    const existing = findTournamentByName(displayName)
    const trimmed = displayName.trim()

    if (!existing) {
      const created = await createTournamentForHistoricalImport({ name: trimmed, createdBy: uploadedBy })
      tournaments = [...tournaments, created]
      tournamentsTouchedIds.add(created.id)
      messages.push(`Torneo creado (cerrado): «${created.name}».`)
      return created
    }

    let t = existing
    tournamentsTouchedIds.add(t.id)

    if (t.name !== trimmed) {
      await updateTournament(t.id, { name: trimmed })
      t = { ...t, name: trimmed }
      const idx = tournaments.findIndex((x) => x.id === t.id)
      if (idx >= 0) tournaments[idx] = t
      messages.push(`Nombre de torneo actualizado a «${trimmed}».`)
    }

    const isPrimaryActive = primaryActive && t.id === primaryActive.id
    /** No tocamos torneos ya `active` (evita cerrar un segundo torneo activo por accidente). */
    if (
      !isPrimaryActive &&
      t.status !== 'active' &&
      t.status !== 'finished' &&
      t.status !== 'archived'
    ) {
      await updateTournament(t.id, {
        status: 'finished',
        finished_at: new Date().toISOString(),
        closed_by: uploadedBy,
      })
      t = { ...t, status: 'finished' }
      const idx = tournaments.findIndex((x) => x.id === t.id)
      if (idx >= 0) tournaments[idx] = t
      messages.push(`Torneo «${t.name}» marcado como cerrado (no es el torneo activo principal).`)
    }

    return t
  }

  async function resolveCategoryId(tournamentId: string, categoryDisplay: string): Promise<string | null> {
    const normalized = normalizeImportCategoryName(categoryDisplay)
    if (!normalized) return null

    let cats = await loadCategories(tournamentId)
    let found = cats.find((c) => normKey(c.name) === normKey(normalized))
    if (found) return found.id

    const nextOrder =
      cats.length === 0 ? 0 : Math.max(...cats.map((c) => c.order_index), 0) + 1
    const created = await createGroupCategory({
      tournamentId,
      name: normalized,
      orderIndex: nextOrder,
    })
    categoriesCreated += 1
    messages.push(`Categoría creada: «${normalized}».`)
    await refreshCategories(tournamentId)
    cats = await loadCategories(tournamentId)
    found = cats.find((c) => c.id === created.id)
    return found?.id ?? created.id
  }

  const rrAfterSync: { tournamentId: string; groupId: string }[] = []

  async function resolveGroup(
    tournamentId: string,
    categoryId: string | null,
    groupDisplayName: string,
  ): Promise<Group> {
    const groups = await loadGroups(tournamentId)
    const trimmedName = groupDisplayName.trim()
    const gn = normKey(trimmedName)
    const sameName = groups.filter((x) => normKey(x.name) === gn)

    let chosen: Group | null =
      sameName.length === 0
        ? null
        : sameName.length === 1
          ? sameName[0]
          : (() => {
              const exactCat = sameName.filter((x) => (x.group_category_id ?? null) === (categoryId ?? null))
              return exactCat.length >= 1 ? exactCat[0] : sameName[0]
            })()

    if (!chosen) {
      const nextOrder =
        groups.length === 0 ? 0 : Math.max(...groups.map((x) => x.order_index), 0) + 1

      const g = await createGroup({
        tournamentId,
        name: trimmedName,
        orderIndex: nextOrder,
        groupCategoryId: categoryId,
      })
      groupsCreated += 1
      messages.push(`Grupo creado: «${trimmedName}».`)
      await refreshGroups(tournamentId)

      rrAfterSync.push({ tournamentId, groupId: g.id })

      return g
    }

    const nameNeedsUpdate = chosen.name !== trimmedName
    const categoryNeedsUpdate = (chosen.group_category_id ?? null) !== (categoryId ?? null)

    if (nameNeedsUpdate || categoryNeedsUpdate) {
      await updateGroup(chosen.id, {
        ...(nameNeedsUpdate ? { name: trimmedName } : {}),
        ...(categoryNeedsUpdate ? { groupCategoryId: categoryId } : {}),
      })
      groupsUpdated += 1
      messages.push(
        nameNeedsUpdate && categoryNeedsUpdate
          ? `Grupo actualizado: «${trimmedName}» (nombre y categoría según CSV).`
          : categoryNeedsUpdate
            ? `Grupo «${trimmedName}»: categoría alineada con el CSV.`
            : `Grupo «${trimmedName}»: nombre alineado con el CSV.`,
      )
      await refreshGroups(tournamentId)
      chosen = {
        ...chosen,
        name: trimmedName,
        group_category_id: categoryId,
      }
    }

    const existingMatches = await listMatchesForGroup(chosen.id)
    if (existingMatches.length === 0) {
      rrAfterSync.push({ tournamentId, groupId: chosen.id })
    }

    return chosen
  }

  for (const triplet of triplets) {
    const tournament = await resolveTournament(triplet.tournamentName)
    const categoryId = await resolveCategoryId(tournament.id, triplet.categoryRaw)
    await resolveGroup(tournament.id, categoryId, triplet.groupName)
  }

  await Promise.all(
    rrAfterSync.map(({ tournamentId, groupId }) =>
      ensureRoundRobinIfPossible(tournamentId, groupId, uploadedBy),
    ),
  )

  return {
    tournamentsTouched: [...tournamentsTouchedIds],
    categoriesCreated,
    groupsCreated,
    groupsUpdated,
    messages,
  }
}
