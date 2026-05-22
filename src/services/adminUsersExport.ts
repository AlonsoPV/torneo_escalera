import Papa from 'papaparse'
import * as XLSX from 'xlsx'

import { formatRecoveryEmailDisplay } from '@/lib/profileEmail'
import { normalizePhone } from '@/lib/phone'
import type { AdminUserRecord } from '@/services/admin'
import type { PlayerCategory } from '@/types/database'

/** Columnas oficiales (exportaciones e importación masiva). */
export const ADMIN_USER_TEMPLATE_HEADERS = [
  'id',
  'nombre',
  'correo_recuperacion',
  'celular',
  'contraseña',
  'cuenta',
  'rol',
  'categoria',
  'grupo',
] as const

export type AdminUserExportRow = Record<(typeof ADMIN_USER_TEMPLATE_HEADERS)[number], string>

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Sin UUID: preferimos ID externo visible. */
export function adminUserExportRow(user: AdminUserRecord, categories: Pick<PlayerCategory, 'id' | 'name'>[]): AdminUserExportRow {
  const cat = categories.find((c) => c.id === user.category_id)
  const phoneNorm = normalizePhone(user.phone ?? '')
  const phoneDigits = phoneNorm.ok ? phoneNorm.digits : (user.phone ?? '').trim()

  let correoRecovery = ''
  const shown = formatRecoveryEmailDisplay(user.email)
  if (shown !== 'Sin correo') correoRecovery = user.email?.trim() ?? ''

  const cuenta = user.status === 'inactive' ? 'inactivo' : 'activo'

  return {
    id: (user.external_id ?? '').trim(),
    nombre: (user.full_name ?? '').trim(),
    correo_recuperacion: correoRecovery,
    celular: phoneDigits,
    contraseña: 'No disponible',
    cuenta,
    rol: user.role,
    categoria: cat?.name?.trim() ?? '',
    grupo: user.group?.name?.trim() ?? '',
  }
}

/** Encabezado + filas como objetos ordenados por ADMIN_USER_TEMPLATE_HEADERS */
function orderedRows(users: AdminUserRecord[], categories: Pick<PlayerCategory, 'id' | 'name'>[]): AdminUserExportRow[] {
  return users.map((u) => adminUserExportRow(u, categories))
}

export function downloadAdminUserExportRowsXlsx(rows: AdminUserExportRow[], filename: string): void {
  const wb = workbookFromUserRows(rows)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  )
}

export function downloadAdminUserExportRowsCsv(rows: AdminUserExportRow[], filename: string): void {
  const csv = Papa.unparse(
    { fields: [...ADMIN_USER_TEMPLATE_HEADERS], data: rows.map((r) => headersToArray(r)) },
    { quotes: true, delimiter: ',', header: true, newline: '\r\n' },
  )
  const bom = '\uFEFF'
  triggerDownload(new Blob([bom + csv], { type: 'text/csv;charset=utf-8' }), filename)
}

function workbookFromUserRows(rows: AdminUserExportRow[]): XLSX.WorkBook {
  const aoa = [ADMIN_USER_TEMPLATE_HEADERS.slice() as unknown as string[], ...rows.map(headersToArray)]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  applyUsuariosSheetFormatting(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Usuarios')
  return wb
}

function headersToArray(r: AdminUserExportRow): string[] {
  return ADMIN_USER_TEMPLATE_HEADERS.map((k) => r[k])
}

function applyUsuariosSheetFormatting(ws: XLSX.WorkSheet): void {
  const ref = ws['!ref']
  if (!ref) return
  const range = XLSX.utils.decode_range(ref)
  const lastCol = range.e.c
  const lastRow = range.e.r
  const colLetter = XLSX.utils.encode_col(lastCol)
  ws['!autofilter'] = { ref: `A1:${colLetter}${lastRow + 1}` }

  const widths: { wch: number }[] = []
  for (let c = 0; c <= lastCol; c++) {
    let max = String(ADMIN_USER_TEMPLATE_HEADERS[c] ?? '').length
    for (let r = 0; r <= lastRow; r++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      const v = cell?.v != null ? String(cell.v) : ''
      max = Math.max(max, Math.min(45, v.length))
    }
    widths.push({ wch: max + 2 })
  }
  ws['!cols'] = widths

  ws['!views'] = [
    {
      state: 'frozen',
      ySplit: 1,
      topLeftCell: 'A2',
      activeCell: 'A2',
      pane: 'bottomLeft',
    },
  ]
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Credenciales / listado: mismas columnas; solo cambia el nombre del archivo. */
export function exportUsersCredentialsXlsx(users: AdminUserRecord[], categories: Pick<PlayerCategory, 'id' | 'name'>[]): void {
  const rows = orderedRows(users, categories)
  const wb = workbookFromUserRows(rows)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `credenciales_usuarios_mega_varonil_${todayYmd()}.xlsx`,
  )
}

export function exportUsersCredentialsCsv(users: AdminUserRecord[], categories: Pick<PlayerCategory, 'id' | 'name'>[]): void {
  const rows = orderedRows(users, categories)
  const csv = Papa.unparse(
    { fields: [...ADMIN_USER_TEMPLATE_HEADERS], data: rows.map((r) => headersToArray(r)) },
    { quotes: true, delimiter: ',', header: true, newline: '\r\n' },
  )
  const bom = '\uFEFF'
  triggerDownload(new Blob([bom + csv], { type: 'text/csv;charset=utf-8' }), `credenciales_usuarios_mega_varonil_${todayYmd()}.csv`)
}

export function exportFilteredUsersXlsx(users: AdminUserRecord[], categories: Pick<PlayerCategory, 'id' | 'name'>[]): void {
  const rows = orderedRows(users, categories)
  const wb = workbookFromUserRows(rows)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `usuarios_filtrados_mega_varonil_${todayYmd()}.xlsx`,
  )
}

export function exportFilteredUsersCsv(users: AdminUserRecord[], categories: Pick<PlayerCategory, 'id' | 'name'>[]): void {
  const rows = orderedRows(users, categories)
  const csv = Papa.unparse(
    { fields: [...ADMIN_USER_TEMPLATE_HEADERS], data: rows.map((r) => headersToArray(r)) },
    { quotes: true, delimiter: ',', header: true, newline: '\r\n' },
  )
  const bom = '\uFEFF'
  triggerDownload(new Blob([bom + csv], { type: 'text/csv;charset=utf-8' }), `usuarios_filtrados_mega_varonil_${todayYmd()}.csv`)
}

/** Plantilla vacía (solo encabezados) — misma forma que las exportaciones. */
export function downloadUsersImportTemplate(): void {
  const wb = workbookFromUserRows([])
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'plantilla_carga_usuarios_mega_varonil.xlsx',
  )
}

export function downloadUsersImportTemplateCsv(): void {
  const bom = '\uFEFF'
  const csv = bom + ADMIN_USER_TEMPLATE_HEADERS.join(',') + '\r\n'
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'plantilla_carga_usuarios_mega_varonil.csv')
}
