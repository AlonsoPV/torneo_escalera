/**
 * API de datos para el panel del jugador (finales / derivados vía getPlayerDashboardData de Supabase).
 */
export { getPlayerDashboardData, getPlayerDashboardDataForGroup, listPlayerDashboardContexts } from './dashboardPlayer'
export {
  getPlayerGroup,
  getPlayerUpcomingMatches,
  getPlayerMatchHistory,
  getPlayerSummary,
  getPlayerStanding,
} from './playerQueries'
export { buildPlayerViewModel, getPlayerViewModelSession, tournamentStatusLabel } from './playerViewModel'
export type { PlayerSummary, PlayerViewModel } from './playerViewModel'
export { getPlayerPerspectiveScore, getPlayerPerspectiveScoreSetsForUserId } from '@/lib/matchUserPerspective'
