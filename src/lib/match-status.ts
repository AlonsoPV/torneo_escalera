import type { MatchRow, MatchStatus } from '@/types/database'

/**
 * Estados homogéneos para UI admin (agrupan varios `MatchStatus` legacy).
 * Permite pestañas y métricas sin duplicar la semántica en cada pantalla.
 */
export type NormalizedAdminMatchStatus =
  | 'scheduled'
  | 'registered'
  | 'pending_review'
  | 'disputed'
  | 'official'
  | 'cancelled'

/** Pestañas principales de `/admin/matches`. */
export type MatchesAdminTabId =
  | 'all'
  | 'scheduled'
  | 'registered'
  | 'pending_review'
  | 'disputed'
  | 'official'

export const MATCHES_ADMIN_TAB_ORDER: { id: MatchesAdminTabId; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'scheduled', label: 'Sin marcador' },
  { id: 'registered', label: 'Registrados' },
  { id: 'pending_review', label: 'Pendientes revisión' },
  { id: 'disputed', label: 'Refutados' },
  { id: 'official', label: 'Oficiales' },
]

export function isMatchesAdminTabId(value: string | null): value is MatchesAdminTabId {
  return MATCHES_ADMIN_TAB_ORDER.some((t) => t.id === value)
}

/** Mapeo legacy → bucket admin (no renombra columnas en BD). */
export function normalizeMatchStatus(status: MatchStatus): NormalizedAdminMatchStatus {
  switch (status) {
    case 'pending_score':
      return 'scheduled'
    case 'score_submitted':
      return 'registered'
    case 'player_confirmed':
      return 'pending_review'
    case 'score_disputed':
      return 'disputed'
    case 'closed':
    case 'validated':
      return 'official'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'scheduled'
  }
}

export function getMatchStatusLabel(status: NormalizedAdminMatchStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Sin marcador'
    case 'registered':
      return 'Registrado'
    case 'pending_review':
      return 'Pendiente revisión'
    case 'disputed':
      return 'Refutado'
    case 'official':
      return 'Oficial'
    case 'cancelled':
      return 'Cancelado'
    default:
      return status
  }
}

/** Clases tipo badge (coherentes con tonos admin existentes). */
export function getMatchStatusColor(status: NormalizedAdminMatchStatus): string {
  switch (status) {
    case 'scheduled':
      return 'border-blue-200 bg-blue-50 text-blue-800'
    case 'registered':
      return 'border-cyan-200 bg-cyan-50 text-cyan-900'
    case 'pending_review':
      return 'border-amber-200 bg-amber-50 text-amber-950'
    case 'disputed':
      return 'border-rose-300 bg-rose-50 text-rose-950'
    case 'official':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900'
    case 'cancelled':
      return 'border-slate-200 bg-slate-100 text-slate-600'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

export function isOfficialMatch(match: Pick<MatchRow, 'status'>): boolean {
  return match.status === 'closed' || match.status === 'validated'
}

export function isPendingReview(match: Pick<MatchRow, 'status'>): boolean {
  return match.status === 'player_confirmed'
}

export function isDisputedMatch(match: Pick<MatchRow, 'status' | 'disputed_by'>): boolean {
  return match.status === 'score_disputed' || (match.status === 'pending_score' && Boolean(match.disputed_by))
}

const ADMIN_SCORE_EDIT_STATUSES: MatchStatus[] = [
  'pending_score',
  'score_submitted',
  'score_disputed',
  'player_confirmed',
  'closed',
  'validated',
]

/** Si el admin puede abrir el modal de marcador (corregir / registrar / resolver). */
export function canAdminEditMatch(match: Pick<MatchRow, 'status'>): boolean {
  if (match.status === 'cancelled') return false
  return ADMIN_SCORE_EDIT_STATUSES.includes(match.status)
}

export function filterMatchesByAdminTab<T extends Pick<MatchRow, 'status' | 'disputed_by'>>(
  rows: T[],
  tab: MatchesAdminTabId,
): T[] {
  if (tab === 'all') return rows
  if (tab === 'disputed') return rows.filter(isDisputedMatch)
  return rows.filter((m) => normalizeMatchStatus(m.status) === tab)
}

export function matchesAdminTabCounts<T extends Pick<MatchRow, 'status' | 'disputed_by'>>(
  rows: T[],
): Record<MatchesAdminTabId, number> {
  const base: Record<MatchesAdminTabId, number> = {
    all: rows.length,
    scheduled: 0,
    registered: 0,
    pending_review: 0,
    disputed: 0,
    official: 0,
  }
  for (const m of rows) {
    if (isDisputedMatch(m)) {
      base.disputed += 1
    }
    const n = normalizeMatchStatus(m.status)
    if (n === 'scheduled') base.scheduled += 1
    else if (n === 'registered') base.registered += 1
    else if (n === 'pending_review') base.pending_review += 1
    else if (n === 'official') base.official += 1
  }
  return base
}

function ts(iso: string | null | undefined): number {
  if (!iso) return 0
  const n = new Date(iso).getTime()
  return Number.isNaN(n) ? 0 : n
}

/** Orden sugerido por pestaña (más recientes o más urgentes primero). */
export function sortMatchesForAdminTab<T extends MatchRow>(rows: T[], tab: MatchesAdminTabId): T[] {
  const arr = [...rows]
  switch (tab) {
    case 'pending_review':
      return arr.sort((a, b) => ts(a.opponent_confirmed_at) - ts(b.opponent_confirmed_at))
    case 'disputed':
      return arr.sort((a, b) => ts(b.updated_at) - ts(a.updated_at))
    case 'registered':
      return arr.sort((a, b) => ts(a.score_submitted_at) - ts(b.score_submitted_at))
    case 'official':
      return arr.sort((a, b) => ts(b.admin_validated_at ?? b.closed_at) - ts(a.admin_validated_at ?? a.closed_at))
    default:
      return arr.sort((a, b) => ts(b.updated_at) - ts(a.updated_at))
  }
}
