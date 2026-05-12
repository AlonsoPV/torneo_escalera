/**
 * Especificación: importación masiva 1 fila = 1 partido.
 * Mapeo CSV → `public.matches` (UUIDs reales, `winner_id` y `player_*` como `group_players.id`).
 */

import type { Json } from '@/types/database'

/** Columnas canónicas del CSV (snake_case). */
export const MATCH_RESULTS_IMPORT_HEADERS = [
  'tournament_name',
  'category_name',
  'group_name',
  'player_a_id',
  'player_a_name',
  'player_b_id',
  'player_b_name',
  'game_type',
  'set_1_a',
  'set_1_b',
  'set_2_a',
  'set_2_b',
  'set_3_a',
  'set_3_b',
  'winner_id',
  'result_type',
  'status',
] as const

export type MatchResultsImportHeader = (typeof MATCH_RESULTS_IMPORT_HEADERS)[number]

/** Textos de ayuda para el asistente de importación (columnas canónicas). */
export const MATCH_RESULTS_IMPORT_COLUMN_GUIDE: { field: MatchResultsImportHeader; hint: string }[] = [
  { field: 'tournament_name', hint: 'Nombre del torneo tal como aparece en el admin.' },
  { field: 'category_name', hint: 'División del grupo; vacío o «-» si el grupo no tiene categoría.' },
  { field: 'group_name', hint: 'Nombre exacto del grupo.' },
  { field: 'player_a_id', hint: 'external_id, UUID de perfil o UUID de group_player.' },
  { field: 'player_a_name', hint: 'Desempate si el ID no alcanza.' },
  { field: 'player_b_id', hint: 'Igual que jugador A.' },
  { field: 'player_b_name', hint: 'Igual que jugador A.' },
  { field: 'game_type', hint: 'best_of_3, sudden_death o long_set.' },
  { field: 'set_1_a', hint: 'Games por set (filas vacías si no aplica).' },
  { field: 'set_1_b', hint: '' },
  { field: 'set_2_a', hint: '' },
  { field: 'set_2_b', hint: '' },
  { field: 'set_3_a', hint: '' },
  { field: 'set_3_b', hint: '' },
  { field: 'winner_id', hint: 'Mismo criterio que IDs de jugador; debe ser A o B.' },
  { field: 'result_type', hint: 'normal, wo, def, cancelled…' },
  { field: 'status', hint: 'pending, closed, cancelled… (ver documentación MVP).' },
]

/** Encabezados alternativos (p. ej. plantilla corta en inglés) → canónico. */
export const MATCH_RESULTS_HEADER_ALIASES: Record<string, MatchResultsImportHeader> = {
  tournament: 'tournament_name',
  tournamentname: 'tournament_name',
  category: 'category_name',
  categoryname: 'category_name',
  group: 'group_name',
  groupname: 'group_name',
  playera_id: 'player_a_id',
  playeraid: 'player_a_id',
  playera_name: 'player_a_name',
  playeraname: 'player_a_name',
  playerb_id: 'player_b_id',
  playerbid: 'player_b_id',
  playerb_name: 'player_b_name',
  playerbname: 'player_b_name',
  gametype: 'game_type',
  set1a: 'set_1_a',
  set1b: 'set_1_b',
  set2a: 'set_2_a',
  set2b: 'set_2_b',
  set3a: 'set_3_a',
  set3b: 'set_3_b',
  winnerid: 'winner_id',
  resulttype: 'result_type',
}

export function normalizeMatchResultsHeader(h: string): string {
  const k = h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
  if (MATCH_RESULTS_IMPORT_HEADERS.includes(k as MatchResultsImportHeader)) return k
  const alias = MATCH_RESULTS_HEADER_ALIASES[k]
  return alias ?? k
}

/**
 * Estados CSV/import → `MatchStatus` de la app.
 * Valores del documento: pending / confirmed / closed se mapean al flujo MVP.
 */
export const CSV_STATUS_TO_MATCH_STATUS: Record<string, string> = {
  pending: 'pending_score',
  pending_score: 'pending_score',
  marcador_enviado: 'score_submitted',
  score_submitted: 'score_submitted',
  en_disputa: 'score_disputed',
  score_disputed: 'score_disputed',
  confirmed: 'player_confirmed',
  player_confirmed: 'player_confirmed',
  rival_confirmo: 'player_confirmed',
  closed: 'closed',
  cerrado: 'closed',
  official: 'closed',
  cancelled: 'cancelled',
  cancelado: 'cancelled',
}

/** Tipos de resultado en CSV → `result_type` en BD (`normal` | `default_win_a` | `default_win_b`). */
export type CsvResultTypeToken = 'normal' | 'wo' | 'def' | 'cancelled' | 'walkover' | 'default'

export function downloadMatchResultsImportTemplate(): void {
  const headers = [
    'tournament_name',
    'category_name',
    'group_name',
    'player_a_id',
    'player_a_name',
    'player_b_id',
    'player_b_name',
    'game_type',
    'set_1_a',
    'set_1_b',
    'set_2_a',
    'set_2_b',
    'set_3_a',
    'set_3_b',
    'winner_id',
    'result_type',
    'status',
  ]
  const sample = [
    'Mega Varonil 2026',
    'Liga de Ascenso',
    'Grupo 7',
    'P001',
    'Chema Arce',
    'P004',
    'Víctor Morales',
    'best_of_3',
    '7',
    '6',
    '6',
    '3',
    '',
    '',
    'P001',
    'normal',
    'closed',
  ]
  const esc = (cell: string) => (/[,"\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)
  const lines = [headers.join(','), sample.map(esc).join(',')]
  const bom = '\uFEFF'
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-import-resultados.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/** Serializa fila parseada para JSON en tabla de auditoría. */
export function rowToAuditPayload(row: Record<string, string>): Json {
  return row as unknown as Json
}
