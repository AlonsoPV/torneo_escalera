/** Permite abrir `/admin/next-tournament` solo tras el flujo previsto desde Torneos (enlace «Crear siguiente torneo»). */
const STORAGE_KEY = 'admin_next_tournament_route_gate'

export function grantAdminNextTournamentRouteAccess(): void {
  sessionStorage.setItem(STORAGE_KEY, '1')
}

export function clearAdminNextTournamentRouteAccess(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function hasAdminNextTournamentRouteAccess(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) === '1'
}
