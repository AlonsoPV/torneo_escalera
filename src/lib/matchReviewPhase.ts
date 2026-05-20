import type { MatchRow, MatchStatus } from '@/types/database'

/** Inclusión en tabla/ranking (BD sin renombrar estados). */
export function matchStatusCountsTowardStandings(status: MatchStatus): boolean {
  return status === 'closed' || status === 'validated'
}

export type MatchReviewPhase =
  | 'pending_marker'
  | 'player_official'
  | 'pending_admin_review'
  | 'admin_validated'
  | 'cancelled'
  | 'legacy_submitted'

export function matchReviewPhase(match: Pick<MatchRow, 'status'>): MatchReviewPhase {
  switch (match.status) {
    case 'pending_score':
      return 'pending_marker'
    case 'score_disputed':
      return 'pending_admin_review'
    case 'validated':
      return 'admin_validated'
    case 'cancelled':
      return 'cancelled'
    case 'closed':
      return 'player_official'
    case 'score_submitted':
    case 'player_confirmed':
      return 'legacy_submitted'
    default:
      return 'pending_marker'
  }
}

/** Ocultar victoria/derrota explícita (revisión admin pendiente). */
export function hidePlayerOutcomeDuringReview(match: Pick<MatchRow, 'status'>): boolean {
  return match.status === 'score_disputed'
}

export const reviewPhaseBadgeLabel: Record<MatchReviewPhase, string> = {
  pending_marker: 'Pendiente',
  player_official: 'Resultado oficial',
  pending_admin_review: 'Pendiente revisión',
  admin_validated: 'Validado',
  cancelled: 'Cancelado',
  legacy_submitted: 'Confirmado',
}

export const reviewPhaseToneClasses: Record<MatchReviewPhase, string> = {
  pending_marker: 'border-blue-200 bg-blue-50 text-blue-800',
  player_official: 'border-green-200 bg-green-50 text-green-800',
  pending_admin_review: 'border-amber-300 bg-amber-50 text-amber-950',
  admin_validated: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-600',
  legacy_submitted: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}
