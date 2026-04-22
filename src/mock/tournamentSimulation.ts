/**
 * Punto de entrada del demo: simulación completa en memoria (sin Supabase).
 * Reexporta utilidades y un bundle listo para la UI.
 */
import { generateTournamentSimulation } from '@/utils/tournamentSimulation'

export {
  DEFAULT_SIMULATION_RATIOS,
  DEMO_SIM_USER_EDGAR_ID,
  DEMO_SIM_USER_ZAIAH_ID,
  generateGroups,
  generatePlayers,
  generateRoundRobinMatchesForGroup,
  generateTournamentSimulation,
  GROUPS,
  MATCHES_PER_GROUP,
  PLAYERS_PER_GROUP,
  PLAYERS_TOTAL,
  simulateMatchResult,
} from '@/utils/tournamentSimulation'

export { invertScore } from '@/utils/tournamentInvert'
export { calculateGroupStandings } from '@/utils/tournamentStandings'

/** Generado una vez al cargar el módulo (estable entre renders). */
export const tournamentSimulationDemo = generateTournamentSimulation()
