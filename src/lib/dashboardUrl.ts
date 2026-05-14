/** Ruta del ranking global con torneo y grupo prefiltrados (query string estable). */
export function dashboardPathWithGroupScope(tournamentId: string, groupId: string): string {
  const q = new URLSearchParams()
  q.set('tournament', tournamentId)
  q.set('group', groupId)
  return `/dashboard?${q.toString()}`
}
