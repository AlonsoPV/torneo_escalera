import type { MatchRow, UserRole } from '@/types/database'

import { canPlayerSubmitResult } from '@/lib/matchStatus'

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin'
}

export function canEditMatchAsPlayer(params: {
  match: MatchRow
  isParticipant: boolean
  allowPlayerScoreEntry: boolean
}): boolean {
  return canPlayerSubmitResult(params)
}

export function canEditMatchAsAdmin(isAdmin: boolean): boolean {
  return isAdmin
}
