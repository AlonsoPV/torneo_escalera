import type { GroupPlayer, MatchRow, MatchStatus } from '@/types/database'

/** Estados que cuentan como “pendientes de validación / cierre oficial”. */
export const RESULT_PENDING_ADMIN_STATUSES: MatchStatus[] = [
  'score_submitted',
  'player_confirmed',
  'score_disputed',
]

/** `YYYY-MM-DD` en calendario local → inicio y fin del día en ms. */
function localDayBounds(ymd: string): { start: number; end: number } | null {
  const parts = ymd.split('-').map((p) => Number(p))
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
  const [y, mo, d] = parts
  const start = new Date(y, mo - 1, d, 0, 0, 0, 0).getTime()
  const end = new Date(y, mo - 1, d, 23, 59, 59, 999).getTime()
  return { start, end }
}

export function filterMatchesForDashboard(
  matches: MatchRow[],
  opts: {
    groupId?: 'all' | string
    status?: 'all' | MatchStatus
    /** Un solo día (según `updated_at`), formato `YYYY-MM-DD`. */
    matchDay?: string
  },
): MatchRow[] {
  let m = matches
  if (opts.groupId && opts.groupId !== 'all') {
    m = m.filter((x) => x.group_id === opts.groupId)
  }
  if (opts.status && opts.status !== 'all') {
    m = m.filter((x) => x.status === opts.status)
  }
  if (opts.matchDay) {
    const b = localDayBounds(opts.matchDay)
    if (b) {
      m = m.filter((x) => {
        if (!x.score_submitted_at) return false
        const t = new Date(x.score_submitted_at).getTime()
        return t >= b.start && t <= b.end
      })
    }
  }
  return m
}

/** Jugadores únicos (por user_id) en los grupos indicados. */
export function countDistinctPlayers(groupPlayers: GroupPlayer[], groupIds: Set<string>): number {
  const users = new Set<string>()
  for (const p of groupPlayers) {
    if (groupIds.has(p.group_id)) users.add(p.user_id)
  }
  return users.size
}

export type TournamentScopeMetrics = {
  totalPlayers: number
  totalGroups: number
  matchesTotal: number
  matchesPlayed: number
  matchesPending: number
  resultsPendingValidation: number
  progressPercent: number
}

/** Métricas sobre un subconjunto de partidos y grupos ya filtrados al alcance deseado. */
export function computeScopeMetrics(
  matches: MatchRow[],
  groupPlayers: GroupPlayer[],
  groupIdsInScope: string[],
): TournamentScopeMetrics {
  const gSet = new Set(groupIdsInScope)
  const totalPlayers = countDistinctPlayers(groupPlayers, gSet)
  const totalGroups = groupIdsInScope.length

  const nonCancelled = matches.filter((m) => m.status !== 'cancelled')
  const matchesTotal = nonCancelled.length
  const matchesPlayed = nonCancelled.filter((m) => m.status === 'closed').length
  const matchesPending = nonCancelled.filter((m) => m.status !== 'closed').length
  const resultsPendingValidation = nonCancelled.filter((m) =>
    RESULT_PENDING_ADMIN_STATUSES.includes(m.status),
  ).length

  const progressPercent =
    matchesTotal > 0 ? Math.min(100, Math.round((matchesPlayed / matchesTotal) * 100)) : 0

  return {
    totalPlayers,
    totalGroups,
    matchesTotal,
    matchesPlayed,
    matchesPending,
    resultsPendingValidation,
    progressPercent,
  }
}
