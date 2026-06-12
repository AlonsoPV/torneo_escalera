import type { AdminGroupRecord, AdminMatchRecord } from '@/services/admin'
import { matchStatusLabels, PLAYER_SCORE_STATUSES } from '@/lib/matchStatus'
import type { MatchStatus } from '@/types/database'
import {
  compareGroupsForPromotionTier,
  isMbBottomTierGroupName,
  parseGroupNameTierNumber,
} from '@/utils/nextTournamentPromotion'

/** `groupId` puede ser `all`, un uuid o varios uuids de grupo separados por `|` (misma etiqueta en el combobox). */
export type AdminMatchScopeFilters = {
  tournamentId: string
  groupId: string
  playerGroupPlayerId: string
}

export function tournamentOptionsFromGroups(groups: AdminGroupRecord[]): Array<{ id: string; name: string }> {
  const map = new Map<string, string>()
  for (const g of groups) {
    const tid = g.tournament_id
    if (!tid) continue
    const name = g.tournament?.name?.trim() || 'Torneo'
    if (!map.has(tid)) map.set(tid, name)
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Primer `tournament_id` cuyo torneo enlazado está en estado `active` (vista admin por defecto). */
export function activeTournamentIdFromGroups(groups: AdminGroupRecord[]): string | null {
  for (const g of groups) {
    if (g.tournament?.status === 'active' && g.tournament_id) {
      return g.tournament_id
    }
  }
  return null
}

export function groupsForTournamentSelect(groups: AdminGroupRecord[], tournamentId: string): AdminGroupRecord[] {
  const list = tournamentId === 'all' ? groups : groups.filter((g) => g.tournament_id === tournamentId)
  return [...list].sort((a, b) =>
    compareGroupsForPromotionTier(
      { id: a.id, name: a.name, order_index: a.order_index ?? 0, players: a.players },
      { id: b.id, name: b.name, order_index: b.order_index ?? 0, players: b.players },
    ),
  )
}

/** Solo torneo + grupo (para poblar el desplegable de jugadores). */
function matchInScopedGroups(matchGroupId: string, scopeGroupId: string): boolean {
  if (scopeGroupId === 'all') return true
  const ids = scopeGroupId.split('|').filter(Boolean)
  return ids.includes(matchGroupId)
}

export function matchesInTournamentGroupScope(
  matches: AdminMatchRecord[],
  tournamentId: string,
  groupId: string,
): AdminMatchRecord[] {
  return matches.filter((m) => {
    if (tournamentId !== 'all' && m.tournament_id !== tournamentId) return false
    if (!matchInScopedGroups(m.group_id, groupId)) return false
    return true
  })
}

export function playerOptionsFromMatches(matches: AdminMatchRecord[]): Array<{ id: string; label: string }> {
  const map = new Map<string, string>()
  for (const m of matches) {
    if (!map.has(m.player_a_id)) map.set(m.player_a_id, m.playerAName)
    if (!map.has(m.player_b_id)) map.set(m.player_b_id, m.playerBName)
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

export function statusFilterOptionsFromMatches(matches: AdminMatchRecord[]): Array<{ value: MatchStatus; label: string }> {
  const seen = new Set(matches.map((m) => m.status))
  return PLAYER_SCORE_STATUSES.filter((status) => seen.has(status)).map((status) => ({
    value: status,
    label: matchStatusLabels[status] ?? status,
  }))
}

export function normalizeAdminFilterLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Orden lógico del nombre visible: GRUPO 1 → 1, GRUPO 15 → 15, MB al final. */
function groupLabelSortTier(label: string): number {
  if (isMbBottomTierGroupName(label)) return Number.MAX_SAFE_INTEGER - 1
  const parsed = parseGroupNameTierNumber(label)
  if (parsed != null) return parsed
  return Number.MAX_SAFE_INTEGER
}

/** Una entrada por nombre de grupo normalizado en el alcance dado; `value` = ids `groups.id` unidos con '|'. */
export function groupFilterOptionsFromRecords(
  groups: AdminGroupRecord[],
  options?: { primarySort?: 'tournament' | 'order_index' | 'group_number' },
): Array<{ value: string; label: string }> {
  const normToIds = new Map<string, string[]>()
  const normToBestLabel = new Map<string, string>()
  const groupById = new Map(groups.map((g) => [g.id, g]))

  for (const g of groups) {
    const rawName = g.name ?? ''
    const norm = normalizeAdminFilterLabel(rawName) || '\u0000'
    const ids = normToIds.get(norm) ?? []
    if (!ids.includes(g.id)) ids.push(g.id)
    normToIds.set(norm, ids)
    const trimmed = rawName.trim()
    const prev = normToBestLabel.get(norm) ?? ''
    if (trimmed.length > prev.length) normToBestLabel.set(norm, trimmed)
  }

  const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

  type Row = { value: string; label: string; sortTournament: string; sortOrderMin: number; sortTierRank: number }
  const rows: Row[] = [...normToIds.entries()].map(([norm, ids]): Row => {
    const best = (normToBestLabel.get(norm) ?? '').trim()
    const label = best.length > 0 ? best : norm === '\u0000' ? 'Sin nombre' : norm

    const tnames = [
      ...new Set(
        ids.map((id) => groupById.get(id)?.tournament?.name?.trim()).filter((n): n is string => Boolean(n)),
      ),
    ].sort(collator.compare)
    const sortTournament = tnames[0] ?? '\uffff'

    const sortOrderMin = Math.min(
      ...ids.map((id) => groupById.get(id)?.order_index ?? 0),
      Number.POSITIVE_INFINITY,
    )

    return {
      value: [...ids].sort().join('|'),
      label,
      sortTournament,
      sortOrderMin,
      sortTierRank: groupLabelSortTier(label),
    }
  })

  rows.sort((a, b) => {
    if (options?.primarySort === 'group_number') {
      if (a.sortTierRank !== b.sortTierRank) return a.sortTierRank - b.sortTierRank
      const byTournament = collator.compare(a.sortTournament, b.sortTournament)
      if (byTournament !== 0) return byTournament
      return collator.compare(a.label, b.label)
    }
    if (options?.primarySort === 'order_index') {
      if (a.sortOrderMin !== b.sortOrderMin) return a.sortOrderMin - b.sortOrderMin
      const byTournament = collator.compare(a.sortTournament, b.sortTournament)
      if (byTournament !== 0) return byTournament
      return collator.compare(a.label, b.label)
    }
    const byTournament = collator.compare(a.sortTournament, b.sortTournament)
    if (byTournament !== 0) return byTournament
    if (a.sortOrderMin !== b.sortOrderMin) return a.sortOrderMin - b.sortOrderMin
    return collator.compare(a.label, b.label)
  })

  return rows.map(({ value, label }) => ({ value, label }))
}

/** Una entrada por persona (`user_id`); si falta usuario en `group_players`, usa `gp:<group_player_id>`. */
export function playerFilterOptionsFromMatches(matches: AdminMatchRecord[]): Array<{ value: string; label: string }> {
  const labelByKey = new Map<string, string>()
  for (const m of matches) {
    const pairs: { key: string; label: string }[] = [
      { key: m.playerAUserId ? `u:${m.playerAUserId}` : `gp:${m.player_a_id}`, label: m.playerAName },
      { key: m.playerBUserId ? `u:${m.playerBUserId}` : `gp:${m.player_b_id}`, label: m.playerBName },
    ]
    for (const { key, label } of pairs) {
      const prev = labelByKey.get(key)
      if (!prev || label.trim().length > prev.trim().length) labelByKey.set(key, label)
    }
  }

  /** Agrupa por nombre normalizado: un solo ítem en el combobox; el `value` lleva todas las claves unidas con '|'. */
  const normToKeys = new Map<string, string[]>()
  const normToBestLabel = new Map<string, string>()
  for (const [key, label] of labelByKey) {
    const norm = normalizeAdminFilterLabel(label) || '\u0000'
    const keys = normToKeys.get(norm) ?? []
    if (!keys.includes(key)) keys.push(key)
    normToKeys.set(norm, keys)
    const trimmed = label.trim()
    const prevBest = normToBestLabel.get(norm) ?? ''
    if (trimmed.length > prevBest.length) normToBestLabel.set(norm, trimmed)
  }

  return [...normToKeys.entries()]
    .map(([norm, keys]) => {
      const best = (normToBestLabel.get(norm) ?? '').trim()
      const label = best.length > 0 ? best : norm === '\u0000' ? 'Sin nombre' : norm
      return {
        value: [...keys].sort().join('|'),
        label,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

function rowMatchesAdminPlayerKey(m: AdminMatchRecord, key: string): boolean {
  if (key.startsWith('u:')) {
    const uid = key.slice(2)
    return m.playerAUserId === uid || m.playerBUserId === uid
  }
  if (key.startsWith('gp:')) {
    const gid = key.slice(3)
    return m.player_a_id === gid || m.player_b_id === gid
  }
  return false
}

/** Filtra por una o varias claves `u:` / `gp:` separadas por '|' (valor del combobox namesafe). */
export function matchesForAdminPlayerKey(matches: AdminMatchRecord[], playerKey: string): AdminMatchRecord[] {
  if (playerKey === 'all') return matches
  const keys = playerKey.split('|').filter(Boolean)
  if (keys.length === 0) return matches
  return matches.filter((m) => keys.some((k) => rowMatchesAdminPlayerKey(m, k)))
}

export function matchesInFullScope(matches: AdminMatchRecord[], scope: AdminMatchScopeFilters): AdminMatchRecord[] {
  const scoped = matches.filter((m) => {
    if (scope.tournamentId !== 'all' && m.tournament_id !== scope.tournamentId) return false
    if (!matchInScopedGroups(m.group_id, scope.groupId)) return false
    return true
  })
  return matchesForAdminPlayerKey(scoped, scope.playerGroupPlayerId)
}
