import { invokeAdminProvisionMatchResultsPlayer } from '@/services/authEdge'
import { findGroupForMatchResultsImport, normImportPlayerName } from '@/services/bulkMatchResultsImport'
import { supabase } from '@/lib/supabase'
import { type AdminGroupRecord, getAdminGroups } from '@/services/admin'
import { addGroupPlayer, listGroupPlayers, removeGroupPlayer, updateGroupPlayerDisplayName } from '@/services/groups'
import { generateRoundRobinMatches, listMatchesForGroup } from '@/services/matches'
import type { Profile } from '@/types/database'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normKey(s: string): string {
  return s.trim().toLowerCase()
}

function looksLikeUuid(s: string): boolean {
  return UUID_RE.test(s.trim())
}

export type MatchResultsPlayerSlot = {
  tournamentName: string
  categoryName: string
  groupName: string
  idToken: string
  nameHint: string
}

function slotKey(s: MatchResultsPlayerSlot): string {
  return `${normKey(s.tournamentName)}|${normKey(s.categoryName)}|${normKey(s.groupName)}|${normKey(s.idToken)}|${normKey(s.nameHint)}`
}

/** Dedupe jugadores por grupo según filas del CSV (A y B). */
export function collectMatchResultsPlayerSlots(rows: Record<string, string>[]): MatchResultsPlayerSlot[] {
  const seen = new Set<string>()
  const out: MatchResultsPlayerSlot[] = []

  for (const cells of rows) {
    const tournamentName = String(cells.tournament_name ?? '').trim()
    const categoryName = String(cells.category_name ?? '').trim()
    const groupName = String(cells.group_name ?? '').trim()
    if (!tournamentName || !groupName) continue

    const pairs = [
      { idToken: String(cells.player_a_id ?? ''), nameHint: String(cells.player_a_name ?? '') },
      { idToken: String(cells.player_b_id ?? ''), nameHint: String(cells.player_b_name ?? '') },
    ]

    for (const { idToken, nameHint } of pairs) {
      if (!idToken.trim() && !nameHint.trim()) continue
      const slot: MatchResultsPlayerSlot = {
        tournamentName,
        categoryName,
        groupName,
        idToken,
        nameHint,
      }
      const key = slotKey(slot)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(slot)
    }
  }

  return out
}

/** Nombre para alta automática: prioriza columna de nombre; si no hay, usa ID externo (no UUID). */
export function deriveMatchResultsProvisionDisplayName(slot: MatchResultsPlayerSlot): string {
  const hint = slot.nameHint.trim()
  const idT = slot.idToken.trim()
  if (hint) return hint
  if (idT && !looksLikeUuid(idT)) return idT
  return ''
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Variantes ILIKE por nombre (URL corto); resultados filtrados a igualdad normalizada. */
async function fetchProfilesByNameHintsLoose(hints: string[]): Promise<Profile[]> {
  const uniq = [...new Set(hints.map((h) => h.trim()).filter(Boolean))]
  if (uniq.length === 0) return []
  const byId = new Map<string, Profile>()
  for (const batch of chunks(uniq, 8)) {
    const orParts = batch.map((h) => {
      const core = h.replace(/%/g, '\\%').replace(/_/g, '\\_').slice(0, 120)
      return `full_name.ilike.%${core}%`
    })
    const { data, error } = await supabase.from('profiles').select('id, full_name, phone, external_id').or(orParts.join(','))
    if (error) throw error
    for (const row of data ?? []) {
      const p = row as Profile
      byId.set(p.id, p)
    }
  }
  return [...byId.values()]
}

async function fetchProfilesByExternalLoose(tokens: string[]): Promise<Profile[]> {
  const uniq = [...new Set(tokens.map((t) => t.replace(/%/g, '').replace(/_/g, '').trim()).filter(Boolean))]
  if (uniq.length === 0) return []
  const byId = new Map<string, Profile>()
  for (const batch of chunks(uniq, 6)) {
    const orParts = batch.map((t) => `external_id.ilike.${t.replace(/%/g, '').slice(0, 80)}`)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, external_id')
      .or(orParts.join(','))
    if (error) throw error
    for (const row of data ?? []) {
      const p = row as Profile
      byId.set(p.id, p)
    }
  }
  return [...byId.values()]
}

/**
 * Resuelve todos los perfiles del CSV en el menor número de consultas posible.
 */
export async function resolveProfilesForMatchSlots(
  slots: MatchResultsPlayerSlot[],
): Promise<Map<string, Profile | null>> {
  const result = new Map<string, Profile | null>()
  if (slots.length === 0) return result

  const uuidSet = new Set<string>()
  const extSet = new Set<string>()
  const exactNameSet = new Set<string>()

  for (const s of slots) {
    const idT = s.idToken.trim()
    const hint = s.nameHint.trim()
    if (idT && looksLikeUuid(idT)) uuidSet.add(idT)
    else if (idT) {
      const cleaned = idT.replace(/%/g, '').replace(/_/g, '').trim()
      if (cleaned) extSet.add(cleaned)
    }
    if (hint) exactNameSet.add(hint)
  }

  const byId = new Map<string, Profile>()
  const byExtNorm = new Map<string, Profile>()
  const byNameNorm = new Map<string, Profile>()

  if (uuidSet.size > 0) {
    const { data, error } = await supabase.from('profiles').select('*').in('id', [...uuidSet])
    if (error) throw error
    for (const row of data ?? []) {
      const p = row as Profile
      byId.set(p.id, p)
    }
  }

  const extList = [...extSet]
  if (extList.length > 0) {
    const { data, error } = await supabase.from('profiles').select('*').in('external_id', extList)
    if (error) throw error
    for (const row of data ?? []) {
      const p = row as Profile
      const nk = normKey(String(p.external_id ?? ''))
      if (nk && !byExtNorm.has(nk)) byExtNorm.set(nk, p)
    }
    const missedExt = extList.filter((t) => !byExtNorm.has(normKey(t)))
    if (missedExt.length > 0) {
      const loose = await fetchProfilesByExternalLoose(missedExt)
      for (const p of loose) {
        const nk = normKey(String(p.external_id ?? ''))
        if (nk && !byExtNorm.has(nk)) byExtNorm.set(nk, p)
      }
    }
  }

  const nameList = [...exactNameSet]
  if (nameList.length > 0) {
    const { data, error } = await supabase.from('profiles').select('*').in('full_name', nameList)
    if (error) throw error
    for (const row of data ?? []) {
      const p = row as Profile
      const nk = normKey(String(p.full_name ?? ''))
      if (nk && !byNameNorm.has(nk)) byNameNorm.set(nk, p)
    }
    const missedNames = nameList.filter((n) => !byNameNorm.has(normKey(n)))
    if (missedNames.length > 0) {
      const loose = await fetchProfilesByNameHintsLoose(missedNames)
      const byNormLists = new Map<string, Profile[]>()
      for (const p of loose) {
        const nk = normKey(String(p.full_name ?? ''))
        if (!nk) continue
        const arr = byNormLists.get(nk) ?? []
        arr.push(p)
        byNormLists.set(nk, arr)
      }
      for (const n of missedNames) {
        const nk = normKey(n)
        if (byNameNorm.has(nk)) continue
        const arr = byNormLists.get(nk) ?? []
        if (arr.length === 1) byNameNorm.set(nk, arr[0])
      }
    }
  }

  function pickProfile(s: MatchResultsPlayerSlot): Profile | null {
    const idT = s.idToken.trim()
    const hint = s.nameHint.trim()

    if (idT && looksLikeUuid(idT)) {
      const pr = byId.get(idT)
      if (pr) return pr
    }

    if (idT && !looksLikeUuid(idT)) {
      const pr = byExtNorm.get(normKey(idT))
      if (pr) return pr
    }

    if (hint) {
      const pr = byNameNorm.get(normKey(hint))
      if (pr) return pr
    }

    return null
  }

  for (const s of slots) {
    result.set(slotKey(s), pickProfile(s))
  }

  return result
}

export type EnrollMatchResultsPlayersResult = {
  enrolled: number
  skippedAlreadyInGroup: number
  /** `display_name` en grupo alineado con el CSV cuando el jugador ya estaba inscrito. */
  rosterLabelsUpdated: number
  /** Jugadores removidos de grupos llenos porque no venían en el roster esperado del CSV. */
  rosterPlayersRemoved: number
  /** Cuentas auth + perfil creadas en esta pasada (importación de resultados). */
  profilesAutoCreated: number
  messages: string[]
}

type ResolvedMatchResultsPlayerSlot = {
  slot: MatchResultsPlayerSlot
  group: AdminGroupRecord
  profile: Profile
}

/**
 * Inscribe jugadores en grupos usando mapa de perfiles ya resuelto (sin N consultas).
 */
async function enrollWithResolvedProfiles(
  slots: MatchResultsPlayerSlot[],
  profilesBySlot: Map<string, Profile | null>,
  groups: AdminGroupRecord[],
  uploadedBy: string,
): Promise<EnrollMatchResultsPlayersResult> {
  const messages: string[] = []
  let enrolled = 0
  let skippedAlreadyInGroup = 0
  let rosterLabelsUpdated = 0
  let rosterPlayersRemoved = 0
  let profilesAutoCreated = 0

  const uidByGroup = new Map<string, Set<string>>()
  function memberUids(groupId: string, seed: AdminGroupRecord['players']): Set<string> {
    if (!uidByGroup.has(groupId)) uidByGroup.set(groupId, new Set(seed.map((p) => p.user_id)))
    return uidByGroup.get(groupId)!
  }

  /** Roster local tras altas en esta pasada (evita listGroupPlayers por fila). */
  const rosterByGroup = new Map<string, AdminGroupRecord['players']>()

  function rosterSnapshot(groupId: string, seed: AdminGroupRecord['players']): AdminGroupRecord['players'] {
    if (!rosterByGroup.has(groupId)) rosterByGroup.set(groupId, [...seed])
    return rosterByGroup.get(groupId)!
  }

  const touchedGroups = new Set<string>()
  const rosterChangedGroups = new Set<string>()
  const resolvedSlots: ResolvedMatchResultsPlayerSlot[] = []
  const expectedUidsByGroup = new Map<string, Set<string>>()

  for (const slot of slots) {
    const group = findGroupForMatchResultsImport(
      groups,
      slot.tournamentName,
      slot.categoryName,
      slot.groupName,
    )
    if (!group?.tournament_id) {
      messages.push(`Sin grupo: ${slot.tournamentName} · ${slot.groupName}`)
      continue
    }

    let profile = profilesBySlot.get(slotKey(slot)) ?? null
    if (!profile) {
      const provisionName = deriveMatchResultsProvisionDisplayName(slot)
      if (!provisionName) {
        messages.push(
          `Sin perfil y datos insuficientes para crear jugador (${slot.idToken || 'sin ID'} / ${slot.nameHint || 'sin nombre'}). Indica al menos nombre completo o un ID externo.`,
        )
        continue
      }
      try {
        const { profile: createdProfile, created } = await invokeAdminProvisionMatchResultsPlayer({
          fullName: provisionName,
          externalId:
            slot.idToken.trim() && !looksLikeUuid(slot.idToken.trim()) ? slot.idToken.trim() : null,
          groupId: group.id,
          tournamentId: group.tournament_id,
        })
        profile = createdProfile
        profilesBySlot.set(slotKey(slot), createdProfile)
        if (created) {
          profilesAutoCreated += 1
          messages.push(`Alta automática de cuenta: ${provisionName}`)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al crear jugador'
        messages.push(`No se pudo crear perfil para «${provisionName}»: ${msg}`)
        continue
      }
    }

    if (!profile) {
      continue
    }

    const expected = expectedUidsByGroup.get(group.id) ?? new Set<string>()
    expected.add(profile.id)
    expectedUidsByGroup.set(group.id, expected)
    resolvedSlots.push({ slot, group, profile })
  }

  for (const [groupId, expectedUids] of expectedUidsByGroup) {
    const group = groups.find((g) => g.id === groupId)
    if (!group) continue

    const cap = group.max_players ?? 5
    if (expectedUids.size > cap) {
      messages.push(
        `«${group.name}»: la plantilla trae ${expectedUids.size} jugadores, pero el grupo permite ${cap}. Revisa duplicados o el máximo del grupo.`,
      )
      continue
    }

    const roster = rosterSnapshot(group.id, group.players)
    const extras = roster.filter((p) => !expectedUids.has(p.user_id))
    if (extras.length === 0) continue

    for (const extra of extras) {
      try {
        await removeGroupPlayer(extra.id)
        rosterPlayersRemoved += 1
      } catch (e) {
        messages.push(
          `«${group.name}»: no se pudo liberar el cupo de ${extra.display_name}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        )
      }
    }

    const nextRoster = roster.filter((p) => expectedUids.has(p.user_id))
    rosterByGroup.set(group.id, nextRoster)
    uidByGroup.set(group.id, new Set(nextRoster.map((p) => p.user_id)))
    group.players = nextRoster
    touchedGroups.add(group.id)
    rosterChangedGroups.add(group.id)
    messages.push(
      `«${group.name}»: roster alineado con la plantilla; ${extras.length} jugador(es) fuera del CSV fueron removidos del grupo.`,
    )
  }

  for (const { slot, group, profile } of resolvedSlots) {
    const expected = expectedUidsByGroup.get(group.id)
    if (expected && expected.size > (group.max_players ?? 5)) continue

    const members = memberUids(group.id, group.players)
    if (members.has(profile.id)) {
      const hint = slot.nameHint.trim()
      const gpRow = rosterSnapshot(group.id, group.players).find((p) => p.user_id === profile.id)
      if (hint && gpRow && normImportPlayerName(gpRow.display_name) !== normImportPlayerName(hint)) {
        try {
          await updateGroupPlayerDisplayName(gpRow.id, hint)
          gpRow.display_name = hint.trim()
          rosterLabelsUpdated += 1
          touchedGroups.add(group.id)
          messages.push(`Nombre en grupo actualizado («${hint}») para ${profile.full_name ?? profile.id}.`)
        } catch (e) {
          messages.push(
            `No se pudo actualizar el nombre en grupo: ${e instanceof Error ? e.message : String(e)}`,
          )
        }
      } else {
        skippedAlreadyInGroup += 1
      }
      continue
    }

    const roster = rosterSnapshot(group.id, group.players)
    const nextSeed = roster.length === 0 ? 0 : Math.max(...roster.map((p) => p.seed_order)) + 1
    const displayName =
      slot.nameHint.trim() || profile.full_name?.trim() || profile.phone?.trim() || 'Jugador'

    try {
      const gp = await addGroupPlayer({
        groupId: group.id,
        userId: profile.id,
        displayName,
        seedOrder: nextSeed,
      })
      members.add(profile.id)
      roster.push({ ...gp, profile })
      group.players = roster
      enrolled += 1
      touchedGroups.add(group.id)
      rosterChangedGroups.add(group.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al inscribir'
      messages.push(`${profile.full_name ?? profile.id}: ${msg}`)
    }
  }

  await Promise.all(
    [...touchedGroups].map(async (gid) => {
      const g = groups.find((x) => x.id === gid)
      const tournamentId = g?.tournament_id
      if (!tournamentId) return

      const players = await listGroupPlayers(gid)
      const existingMatches = await listMatchesForGroup(gid)
      if (players.length >= 2 && (rosterChangedGroups.has(gid) || existingMatches.length === 0)) {
        try {
          await generateRoundRobinMatches({
            tournamentId,
            groupId: gid,
            players,
            createdBy: uploadedBy,
            mode: 'fill',
          })
        } catch (e) {
          messages.push(
            `RR «${g?.name ?? gid}»: ${e instanceof Error ? e.message : 'error'}`,
          )
        }
      }
    }),
  )

  return {
    enrolled,
    skippedAlreadyInGroup,
    rosterLabelsUpdated,
    rosterPlayersRemoved,
    profilesAutoCreated,
    messages,
  }
}

export async function enrollPlayersForMatchResultsImport(
  rows: Record<string, string>[],
  uploadedBy: string,
): Promise<EnrollMatchResultsPlayersResult> {
  const slots = collectMatchResultsPlayerSlots(rows)
  if (slots.length === 0) {
    return {
      enrolled: 0,
      skippedAlreadyInGroup: 0,
      rosterLabelsUpdated: 0,
      rosterPlayersRemoved: 0,
      profilesAutoCreated: 0,
      messages: [],
    }
  }

  const [groups, profilesBySlot] = await Promise.all([
    getAdminGroups(),
    resolveProfilesForMatchSlots(slots),
  ])

  return enrollWithResolvedProfiles(slots, profilesBySlot, groups, uploadedBy)
}

/** Compat: una sola resolución (usa el mismo motor por lotes). */
export async function resolveProfileForMatchResultsImport(
  idToken: string,
  nameHint: string,
): Promise<Profile | null> {
  const slot: MatchResultsPlayerSlot = {
    tournamentName: '_',
    categoryName: '',
    groupName: '_',
    idToken,
    nameHint,
  }
  const map = await resolveProfilesForMatchSlots([slot])
  return map.get(slotKey(slot)) ?? null
}
