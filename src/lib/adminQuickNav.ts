import type { QueryClient } from '@tanstack/react-query'

const ADMIN_QUICK_NAV_QUERY_KEYS: Record<string, readonly (readonly string[])[]> = {
  '/admin/users': [['admin-users'], ['admin-groups'], ['player-categories']],
  '/admin/groups': [['admin-tournaments'], ['admin-groups'], ['group-categories'], ['profiles-admin']],
  '/admin/matches': [['admin-matches'], ['admin-groups']],
  '/dashboard': [['tournament-dashboard-options'], ['tournament-dashboard']],
}

/** URL de destino con torneo en query cuando aplica. */
export function adminQuickNavHref(href: string, tournamentId?: string | null): string {
  if (!tournamentId?.trim()) return href
  if (href === '/admin/groups' || href === '/admin/matches' || href === '/dashboard') {
    return `${href}?tournament=${encodeURIComponent(tournamentId)}`
  }
  return href
}

/** Fuerza recarga de datos al saltar desde acciones rápidas del overview. */
export async function refreshAdminQuickNavSection(qc: QueryClient, href: string): Promise<void> {
  const keys = ADMIN_QUICK_NAV_QUERY_KEYS[href] ?? []
  await Promise.all(
    keys.map((queryKey) =>
      qc.invalidateQueries({ queryKey, refetchType: 'all' }),
    ),
  )
}
