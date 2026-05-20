import type { Json, MatchStatus, StaffMatchNotification } from '@/types/database'

export function buildAdminMatchesUrlScoped(row: StaffMatchNotification): string {
  const params = new URLSearchParams()
  params.set('tournament', row.tournament_id)
  params.set('group', row.group_id)
  return `/admin/matches?${params.toString()}`
}

/** Query alineada con `AdminMatchesPage` (`tournament`, `group`, `status`, `match`). */
export function buildAdminMatchesUrlFromStaffNotification(row: StaffMatchNotification): string {
  const params = new URLSearchParams()
  params.set('tournament', row.tournament_id)
  params.set('group', row.group_id)
  params.set('tab', 'disputed')
  params.set('status', 'score_disputed')
  params.set('match', row.match_id)
  return `/admin/matches?${params.toString()}`
}

export function parseStaffNotificationMetadata(metadata: Json): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>
  }
  return {}
}

export function formatScoreRawSnippet(scoreRaw: unknown): string | null {
  if (!Array.isArray(scoreRaw) || scoreRaw.length === 0) return null
  const parts: string[] = []
  for (const el of scoreRaw) {
    if (el && typeof el === 'object' && !Array.isArray(el)) {
      const o = el as Record<string, unknown>
      const a = o.a
      const b = o.b
      if (typeof a === 'number' && typeof b === 'number') {
        parts.push(`${a}-${b}`)
      }
    }
  }
  return parts.length ? parts.join(' · ') : null
}

const ADMIN_MATCHES_URL_STATUSES = new Set<string>([
  'pending_score',
  'score_submitted',
  'score_disputed',
  'player_confirmed',
  'closed',
  'validated',
  'cancelled',
])

/** Parsea `status` en URL de `/admin/matches`. */
export function parseAdminMatchesStatusQueryParam(value: string | null): MatchStatus | null {
  if (!value) return null
  return ADMIN_MATCHES_URL_STATUSES.has(value) ? (value as MatchStatus) : null
}
