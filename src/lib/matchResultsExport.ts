import { MATCH_RESULTS_IMPORT_HEADERS, type MatchResultsImportHeader } from '@/lib/matchResultsImportSpec'
import type { AdminMatchRecord } from '@/services/admin'
import type { MatchResultType, MatchStatus } from '@/types/database'

type MatchResultsExportRow = Record<MatchResultsImportHeader, string>

function csvEscape(cell: string): string {
  return /[,"\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
}

function statusForImport(status: MatchStatus): string {
  if (status === 'validated') return 'closed'
  return status
}

function resultTypeForImport(resultType: MatchResultType): string {
  if (resultType === 'default_win_a' || resultType === 'default_win_b') return 'def'
  if (resultType === 'retired') return 'ret'
  if (resultType === 'retired_draw') return 'ret_draw'
  return resultType
}

function setValue(match: AdminMatchRecord, index: number, side: 'a' | 'b'): string {
  const value = match.score_raw?.[index]?.[side]
  return typeof value === 'number' ? String(value) : ''
}

function playerExportId(match: AdminMatchRecord, side: 'a' | 'b'): string {
  return side === 'a'
    ? match.playerAExternalId || match.player_a_id
    : match.playerBExternalId || match.player_b_id
}

function winnerExportId(match: AdminMatchRecord): string {
  if (match.winner_id === match.player_a_id) return playerExportId(match, 'a')
  if (match.winner_id === match.player_b_id) return playerExportId(match, 'b')
  return match.winner_id ?? ''
}

function filenameSafe(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export function matchToImportCompatibleRow(match: AdminMatchRecord): MatchResultsExportRow {
  return {
    tournament_name: match.tournamentName,
    category_name: match.categoryName,
    group_name: match.groupName,
    player_a_id: playerExportId(match, 'a'),
    player_a_name: match.playerAName,
    player_b_id: playerExportId(match, 'b'),
    player_b_name: match.playerBName,
    game_type: match.game_type,
    set_1_a: setValue(match, 0, 'a'),
    set_1_b: setValue(match, 0, 'b'),
    set_2_a: setValue(match, 1, 'a'),
    set_2_b: setValue(match, 1, 'b'),
    set_3_a: setValue(match, 2, 'a'),
    set_3_b: setValue(match, 2, 'b'),
    winner_id: winnerExportId(match),
    result_type: match.status === 'cancelled' ? 'normal' : resultTypeForImport(match.result_type),
    status: statusForImport(match.status),
  }
}

export function buildMatchResultsExportCsv(matches: AdminMatchRecord[]): string {
  const rows = matches.map(matchToImportCompatibleRow)
  const lines = [
    MATCH_RESULTS_IMPORT_HEADERS.join(','),
    ...rows.map((row) => MATCH_RESULTS_IMPORT_HEADERS.map((header) => csvEscape(row[header] ?? '')).join(',')),
  ]
  return `\uFEFF${lines.join('\r\n')}`
}

export function downloadMatchResultsExportCsv(matches: AdminMatchRecord[], scopeLabel = 'partidos-resultados'): void {
  const blob = new Blob([buildMatchResultsExportCsv(matches)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `export-${filenameSafe(scopeLabel) || 'partidos-resultados'}-${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
