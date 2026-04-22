import type { UserRole } from '@/types/database'

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'admin'
}

export function canEditMatchAsPlayer(params: {
  status: string
  isParticipant: boolean
  allowPlayerScoreEntry: boolean
}): boolean {
  if (!params.allowPlayerScoreEntry || !params.isParticipant) return false
  return params.status === 'pending'
}

export function canEditMatchAsAdmin(isAdmin: boolean): boolean {
  return isAdmin
}
