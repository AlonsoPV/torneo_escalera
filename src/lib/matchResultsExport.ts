import { MATCH_RESULTS_IMPORT_HEADERS, type MatchResultsImportHeader } from '@/lib/matchResultsImportSpec'
import { importResultTypeBothPenalized } from '@/lib/matchResultSemantics'
import type { AdminMatchRecord } from '@/services/admin'
import type { GroupPlayer, MatchResultType, MatchStatus, TournamentRules } from '@/types/database'
import { perspectiveSetsForCell, computeGroupRanking } from '@/utils/ranking'
import { getOfficialWinnerGroupPlayerId } from '@/utils/matchOfficialWinner'

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

type MatchMatrixPlayer = GroupPlayer & {
  externalId: string | null
}

type MatchMatrixGroup = {
  key: string
  tournamentName: string
  leagueName: string
  groupName: string
  players: MatchMatrixPlayer[]
  matches: AdminMatchRecord[]
}

function matchKey(a: string, b: string): string {
  return [a, b].sort().join('::')
}

function matrixGroups(matches: AdminMatchRecord[]): MatchMatrixGroup[] {
  const groups = new Map<string, MatchMatrixGroup>()

  for (const match of matches) {
    const key = match.group_id
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        tournamentName: match.tournamentName || 'Liga no disponible',
        leagueName: match.categoryName || match.tournamentName || 'Liga no disponible',
        groupName: match.groupName || 'Grupo no disponible',
        players: [],
        matches: [],
      }
      groups.set(key, group)
    }

    group.matches.push(match)

    if (!group.players.some((p) => p.id === match.player_a_id)) {
      group.players.push({
        id: match.player_a_id,
        group_id: match.group_id,
        user_id: match.playerAUserId ?? match.player_a_user_id,
        display_name: match.playerAName,
        seed_order: group.players.length + 1,
        created_at: match.created_at,
        externalId: match.playerAExternalId,
      })
    }
    if (!group.players.some((p) => p.id === match.player_b_id)) {
      group.players.push({
        id: match.player_b_id,
        group_id: match.group_id,
        user_id: match.playerBUserId ?? match.player_b_user_id,
        display_name: match.playerBName,
        seed_order: group.players.length + 1,
        created_at: match.created_at,
        externalId: match.playerBExternalId,
      })
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      players: [...group.players].sort(
        (a, b) => a.seed_order - b.seed_order || a.display_name.localeCompare(b.display_name, 'es'),
      ),
    }))
    .sort((a, b) => {
      const tournament = a.tournamentName.localeCompare(b.tournamentName, 'es', { numeric: true, sensitivity: 'base' })
      if (tournament !== 0) return tournament
      return a.groupName.localeCompare(b.groupName, 'es', { numeric: true, sensitivity: 'base' })
    })
}

function scoreLabelForCell(rowPlayerId: string, colPlayerId: string, match: AdminMatchRecord | undefined): string {
  if (!match) return '-'
  if (match.status === 'cancelled') return 'Cancelado'
  if (match.status === 'pending_score' && !match.score_raw?.length) return '-'
  const sets = perspectiveSetsForCell(rowPlayerId, colPlayerId, match)
  if (!sets?.length) {
    if (match.result_type === 'wo') return 'W.O.'
    if (match.result_type === 'def' || match.result_type === 'default_win_a' || match.result_type === 'default_win_b') return 'DEF'
    if (match.result_type === 'not_reported') return 'N/R'
    if (match.result_type === 'double_penalty') return 'Doble penal.'
    if (match.result_type === 'retired') return 'RET'
    return '-'
  }
  return sets.map((set) => `${set.a}-${set.b}`).join(', ')
}

function sheetNameSafe(raw: string): string {
  return (
    raw
      .replace(/[:\\/?*[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 31) || 'Torneo'
  )
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function colName(index: number): string {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function cellRef(rowIndex: number, colIndex: number): string {
  return `${colName(colIndex)}${rowIndex + 1}`
}

function cellXml(rowIndex: number, colIndex: number, value: string | number, styleId: number): string {
  const ref = cellRef(rowIndex, colIndex)
  if (typeof value === 'number') return `<c r="${ref}" s="${styleId}"><v>${value}</v></c>`
  return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`
}

function rowXml(rowIndex: number, cells: string[], height = 24): string {
  return `<row r="${rowIndex + 1}" ht="${height}" customHeight="1">${cells.join('')}</row>`
}

function buildMatrixWorksheetXml(groups: MatchMatrixGroup[], rules: TournamentRules): string {
  const maxPlayerCount = Math.max(0, ...groups.map((group) => group.players.length))
  const lastCol = 2 + maxPlayerCount + 4 - 1
  const cols = [
    '<col min="1" max="1" width="6" customWidth="1"/>',
    '<col min="2" max="2" width="28" customWidth="1"/>',
    maxPlayerCount > 0 ? `<col min="3" max="${2 + maxPlayerCount}" width="17" customWidth="1"/>` : '',
    `<col min="${3 + maxPlayerCount}" max="${6 + maxPlayerCount}" width="8" customWidth="1"/>`,
  ].join('')

  let rowOffset = 0
  const rows: string[] = []
  const merges: string[] = []

  for (const group of groups) {
    const playerCount = group.players.length
    const groupLastCol = 2 + playerCount + 4 - 1
    merges.push(
      `<mergeCell ref="${cellRef(rowOffset, 0)}:${cellRef(rowOffset, groupLastCol)}"/>`,
      `<mergeCell ref="${cellRef(rowOffset + 1, 1)}:${cellRef(rowOffset + 1, groupLastCol)}"/>`,
      `<mergeCell ref="${cellRef(rowOffset + 2, 1)}:${cellRef(rowOffset + 2, groupLastCol)}"/>`,
      `<mergeCell ref="${cellRef(rowOffset + 3, 1)}:${cellRef(rowOffset + 3, groupLastCol)}"/>`,
    )

    rows.push(rowXml(rowOffset, [cellXml(rowOffset, 0, `${group.leagueName} - ${group.groupName}`, 1)], 26))
    rows.push(rowXml(rowOffset + 1, [cellXml(rowOffset + 1, 0, 'Liga', 2), cellXml(rowOffset + 1, 1, group.leagueName, 3)]))
    rows.push(rowXml(rowOffset + 2, [cellXml(rowOffset + 2, 0, 'Torneo', 2), cellXml(rowOffset + 2, 1, group.tournamentName, 3)]))
    rows.push(rowXml(rowOffset + 3, [cellXml(rowOffset + 3, 0, 'Grupo', 2), cellXml(rowOffset + 3, 1, group.groupName, 3)]))
    rows.push(rowXml(rowOffset + 4, [], 8))
    rows.push(
      rowXml(
        rowOffset + 5,
        ['#', 'JUGADOR', ...group.players.map((_, index) => index + 1), 'PG', 'PP', 'PTS', 'POS'].map((value, colIndex) =>
          cellXml(rowOffset + 5, colIndex, value, 4),
        ),
        28,
      ),
    )

    const matchByPair = new Map(group.matches.map((match) => [matchKey(match.player_a_id, match.player_b_id), match]))
    const ranking = computeGroupRanking(group.players, group.matches, rules)
    const rankingByPlayer = new Map(ranking.map((rank) => [rank.groupPlayerId, rank]))
    group.players.forEach((player, rowIndex) => {
      const r = rowOffset + 6 + rowIndex
      const rankingRow = rankingByPlayer.get(player.id)
      const cells = [cellXml(r, 0, rowIndex + 1, 11), cellXml(r, 1, player.display_name, 5)]
      for (let c = 0; c < playerCount; c += 1) {
        const opponent = group.players[c]
        const colIndex = c + 2
        if (player.id === opponent.id) {
          cells.push(cellXml(r, colIndex, '-', 9))
          continue
        }
        const match = matchByPair.get(matchKey(player.id, opponent.id))
        const label = scoreLabelForCell(player.id, opponent.id, match)
        const winner = match ? getOfficialWinnerGroupPlayerId(match, rules) : null
        if (match && importResultTypeBothPenalized(match.result_type) && match.status !== 'pending_score') {
          cells.push(cellXml(r, colIndex, label, 7))
          continue
        }
        if (!match || match.status === 'pending_score' || match.status === 'cancelled' || !winner) {
          cells.push(cellXml(r, colIndex, label, 8))
        } else {
          cells.push(cellXml(r, colIndex, label, winner === player.id ? 6 : 7))
        }
      }
      cells.push(
        cellXml(r, 2 + playerCount, rankingRow?.won ?? 0, 10),
        cellXml(r, 3 + playerCount, rankingRow?.lost ?? 0, 10),
        cellXml(r, 4 + playerCount, rankingRow?.points ?? 0, 10),
        cellXml(r, 5 + playerCount, rankingRow?.position ?? rowIndex + 1, 10),
      )
      rows.push(rowXml(r, cells, 42))
    })

    rowOffset += 7 + playerCount
  }

  const mergeXml = merges.length ? `<mergeCells count="${merges.length}">${merges.join('')}</mergeCells>` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${cellRef(Math.max(rowOffset - 1, 0), Math.max(lastCol, 0))}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols}</cols>
  <sheetData>${rows.join('')}</sheetData>
  ${mergeXml}
</worksheet>`
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FF102A43"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FF506783"/><name val="Arial"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F5A4C"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF102A43"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF6F2ED"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE6F8ED"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF0F1"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD7E1ED"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD9D5CE"/></left>
      <right style="thin"><color rgb="FFD9D5CE"/></right>
      <top style="thin"><color rgb="FFD9D5CE"/></top>
      <bottom style="thin"><color rgb="FFD9D5CE"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="12">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff])
}

function u32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff])
}

function zipStore(files: { name: string; content: string }[]): Uint8Array {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0
  const now = new Date()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

  for (const file of files) {
    const name = utf8(file.name)
    const content = utf8(file.content)
    const crc = crc32(content)
    const localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(content.length),
      u32(content.length),
      u16(name.length),
      u16(0),
      name,
    ])
    localParts.push(localHeader, content)

    centralParts.push(
      concatBytes([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(dosTime),
        u16(dosDate),
        u32(crc),
        u32(content.length),
        u32(content.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    )
    offset += localHeader.length + content.length
  }

  const central = concatBytes(centralParts)
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ])
  return concatBytes([...localParts, central, end])
}

function matrixWorkbookBytes(groups: MatchMatrixGroup[], rules: TournamentRules): Uint8Array {
  const sheetName = sheetNameSafe(groups[0]?.tournamentName ?? 'Torneo')
  return zipStore([
    {
      name: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    },
    { name: 'xl/styles.xml', content: stylesXml() },
    { name: 'xl/worksheets/sheet1.xml', content: buildMatrixWorksheetXml(groups, rules) },
  ])
}

export function downloadMatchResultsMatrixExcel(
  matches: AdminMatchRecord[],
  rules: TournamentRules,
  scopeLabel = 'partidos-resultados',
): void {
  const groups = matrixGroups(matches)
  const buf = matrixWorkbookBytes(groups, rules)
  const blobBuffer = new ArrayBuffer(buf.byteLength)
  new Uint8Array(blobBuffer).set(buf)
  const url = URL.createObjectURL(
    new Blob([blobBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  )
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `matriz-${filenameSafe(scopeLabel) || 'partidos-resultados'}-${date}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
