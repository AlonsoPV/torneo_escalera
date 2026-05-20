import type { EnrollMatchResultsPlayersResult } from '@/services/matchResultsImportPlayers'
import {
  syncMatchResultsImportStructure,
  type SyncMatchResultsImportStructureResult,
} from '@/services/matchResultsImportStructure'
import { enrollPlayersForMatchResultsImport } from '@/services/matchResultsImportPlayers'
import { ensureRoundRobinMatchesForMatchResultsCsv } from '@/services/bulkMatchResultsImport'

export type PrepareMatchResultsImportResult = {
  structure: SyncMatchResultsImportStructureResult
  enrollment: EnrollMatchResultsPlayersResult
  roundRobin: { groupsTouched: number; matchesInserted: number; messages: string[] }
  elapsedMs: number
}

/**
 * Una pasada ordenada: estructura (torneo/categorías/grupos) → inscripción de jugadores desde CSV → cruces RR en grupos del CSV.
 * El caller debe invalidar/refetch `admin-groups` / `admin-matches` después.
 */
export async function prepareMatchResultsImport(
  rows: Record<string, string>[],
  userId: string,
): Promise<PrepareMatchResultsImportResult> {
  const t0 = performance.now()
  const structure = await syncMatchResultsImportStructure(rows, userId)
  const enrollment = await enrollPlayersForMatchResultsImport(rows, userId)
  const roundRobin = await ensureRoundRobinMatchesForMatchResultsCsv(rows, userId)
  const elapsedMs = Math.round(performance.now() - t0)
  return { structure, enrollment, roundRobin, elapsedMs }
}
