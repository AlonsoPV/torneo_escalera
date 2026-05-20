import type { AdminGroupRecord, AdminMatchRecord } from '@/services/admin'

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
  return [...list].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.name.localeCompare(b.name, 'es'))
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

export function normalizeAdminFilterLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Una entrada por nombre de grupo normalizado en el alcance dado; `value` = ids `groups.id` unidos con '|'. */
export function groupFilterOptionsFromRecords(groups: AdminGroupRecord[]): Array<{ value: string; label: string }> {
  const normToIds = new Map<string, string[]>()
  const normToBestLabel = new Map<string, string>()
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
  return [...normToIds.entries()]
    .map(([norm, ids]) => {
      const best = (normToBestLabel.get(norm) ?? '').trim()
      const label = best.length > 0 ? best : norm === '\u0000' ? 'Sin nombre' : norm
      return {
        value: [...ids].sort().join('|'),
        label,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
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
  return matches.filter((m) => {
    if (scope.tournamentId !== 'all' && m.tournament_id !== scope.tournamentId) return false
    if (!matchInScopedGroups(m.group_id, scope.groupId)) return false
    if (
      scope.playerGroupPlayerId !== 'all' &&
      m.player_a_id !== scope.playerGroupPlayerId &&
      m.player_b_id !== scope.playerGroupPlayerId
    ) {
      return false
    }
    return true
  })
}
