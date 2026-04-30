/**
 * Servicios de administración de reglas de torneo.
 * La persistencia vive en `tournaments.ts` (`getTournamentRules`, `updateTournamentRules`, `resetTournamentRulesToDefault`).
 */
export { getTournamentRules, resetTournamentRulesToDefault, updateTournamentRules } from '@/services/tournaments'
export { validateRulesPayload } from '@/domain/tournamentRulesForm'
