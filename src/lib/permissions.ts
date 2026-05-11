import type { MatchRow, UserRole } from '@/types/database'

import {
  canAcceptScore,
  canAdminCloseScore,
  canAdminCorrectScore,
  canPlayerSubmitResult,
  canRejectScore,
  canSubmitScore,
} from '@/lib/matchStatus'

/** Etiqueta visible en UI (selects, badges) — nunca mostrar el slug crudo al usuario. */
export const USER_ROLE_LABEL_ES: Record<UserRole, string> = {
  player: 'Jugador',
  admin: 'Administrador',
  super_admin: 'Super administrador',
  captain: 'Capitán',
  referee: 'Árbitro',
}

export function userRoleLabelEs(role: UserRole | string | null | undefined): string {
  if (!role) return '—'
  return USER_ROLE_LABEL_ES[role as UserRole] ?? String(role)
}

/** Orden estable para filtros de rol en admin (todos los valores de `UserRole`). */
export const ADMIN_USER_FILTER_ROLES: readonly UserRole[] = ['player', 'admin', 'super_admin', 'captain', 'referee']

/** Roles que se pueden filtrar, crear y asignar en Admin → Usuarios. */
export const ADMIN_USER_ASSIGNABLE_ROLES: readonly UserRole[] = ['player', 'super_admin']

export function normalizeAdminAssignableRole(role: UserRole): UserRole {
  return ADMIN_USER_ASSIGNABLE_ROLES.includes(role) ? role : 'player'
}

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin'
}

export function canEditMatchAsPlayer(params: {
  match: MatchRow
  isParticipant: boolean
  allowPlayerScoreEntry: boolean
  currentUserId?: string | null
}): boolean {
  return canPlayerSubmitResult({
    ...params,
    userId: params.currentUserId,
  })
}

export function canEditMatchAsAdmin(isAdmin: boolean): boolean {
  return isAdmin
}

export {
  canAcceptScore,
  canAdminCloseScore,
  canAdminCorrectScore,
  canRejectScore,
  canSubmitScore,
}
