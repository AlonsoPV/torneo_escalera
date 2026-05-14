/** Normaliza etiqueta de categoría o grupo para mostrar y comparar (title case por palabra). */
export function normalizeImportLabel(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** Contraseña en carga masiva: exactamente 8 dígitos (0-9). */
export function isValidImportNumericPassword(s: string): boolean {
  return /^\d{8}$/.test(String(s ?? '').trim())
}

const TEMPLATE_HEADERS = ['ID', 'Nombre', 'Celular', 'Rol', 'Categoría', 'Contraseña', 'Grupo', 'PJ', 'Pts'] as const

const SAMPLE_ROWS = [
  ['001', 'Carlos Ramírez', '5512345678', 'player', 'Varonil', '10000001', 'Grupo A', '2', '6'],
  ['002', 'Rodrigo Pérez', '5587654321', 'player', 'Varonil', '10000002', '', '', ''],
  ['003', 'Ana López', '5511122233', 'player', 'Femenil', '10000003', '', '0', '3'],
  ['', 'Actualización solo celular', '5599887766', 'player', 'Varonil', '', '', '', ''],
]

/** Descarga plantilla CSV (UTF-8 con BOM para Excel). */
export function downloadUserImportTemplate(): void {
  const lines = [
    TEMPLATE_HEADERS.join(','),
    ...SAMPLE_ROWS.map((r) =>
      r.map((cell) => (/,/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','),
    ),
  ]
  const bom = '\uFEFF'
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-import-usuarios.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export type CredentialExportRow = {
  ID: string
  Nombre: string
  Celular: string
  Contraseña: string
  Categoría: string
  Acción: string
}

export function downloadBulkCredentialsCsv(rows: CredentialExportRow[]): void {
  const headers: (keyof CredentialExportRow)[] = ['ID', 'Nombre', 'Celular', 'Contraseña', 'Categoría', 'Acción']
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const cell = String(r[h] ?? '')
          return /[,"\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
        })
        .join(','),
    ),
  ]
  const bom = '\uFEFF'
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `credenciales-import-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export { TEMPLATE_HEADERS }
