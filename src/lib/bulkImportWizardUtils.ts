import type { BulkImportPreviewRow } from '@/lib/bulkUserImportPreview'

/** Documentación de columnas reconocidas (coincide con `mapSheetRow` en servicios). */
export const BULK_IMPORT_COLUMN_GUIDE = [
  {
    headers: 'ID, Id, external_id',
    field: 'Identificador (opcional)',
    required: false,
    hint: 'Opcional. Si coincide con un usuario existente, la fila actualiza ese registro.',
  },
  {
    headers: 'Nombre, name',
    field: 'Nombre completo',
    required: true,
    hint: 'Se muestra en el torneo y admin.',
  },
  {
    headers: 'Celular, Teléfono, Móvil',
    field: 'Número de celular',
    required: true,
    hint: 'Obligatorio. Único en archivo y en la base; se normaliza (solo dígitos, sin +52).',
  },
  {
    headers: 'Rol, role',
    field: 'Rol',
    required: false,
    hint: 'player, admin o super_admin (super_admin solo si tu cuenta es super admin).',
  },
  {
    headers: 'Categoría, category',
    field: 'Categoría de jugador',
    required: true,
    hint: 'Debe existir o marcarse “crear categorías faltantes”.',
  },
  {
    headers: 'Contraseña, password',
    field: 'Contraseña',
    required: 'Condicional',
    hint: '8 dígitos para altas; vacía en actualización para no cambiar.',
  },
  {
    headers: 'Grupo, group',
    field: 'Grupo',
    required: false,
    hint: 'Solo jugadores; requiere torneo seleccionado. El servidor puede crear el grupo.',
  },
  {
    headers: 'PJ',
    field: 'Partidos jugados (histórico)',
    required: false,
    hint: 'Entero ≥ 0 o vacío.',
  },
  {
    headers: 'Pts',
    field: 'Puntos (histórico)',
    required: false,
    hint: 'Entero (puede ser negativo) o vacío.',
  },
] as const

export type BulkImportPreviewSummary = {
  totalRows: number
  ready: number
  warning: number
  error: number
  importableRows: number
  likelyCreates: number
  likelyUpdates: number
  newCategoryNames: string[]
  newGroupNames: string[]
}

export function buildBulkImportPreviewSummary(preview: BulkImportPreviewRow[]): BulkImportPreviewSummary {
  const newCategoryNames = new Set<string>()
  const newGroupNames = new Set<string>()
  let ready = 0
  let warning = 0
  let error = 0
  let likelyCreates = 0
  let likelyUpdates = 0

  for (const r of preview) {
    if (r.state === 'ready') ready++
    else if (r.state === 'warning') warning++
    else error++

    const isUpdate = r.messages.some((m) => m.includes('ya existe en el sistema'))
    if (r.state !== 'error') {
      if (isUpdate) likelyUpdates++
      else likelyCreates++
    }

    for (const m of r.messages) {
      const catPrefix = 'Se creará la categoría "'
      const grpPrefix = 'Se creará el grupo "'
      if (m.startsWith(catPrefix) && m.endsWith('".')) {
        newCategoryNames.add(m.slice(catPrefix.length, -2))
      }
      const grpSuffix = '" en el torneo al importar.'
      if (m.startsWith(grpPrefix) && m.endsWith(grpSuffix)) {
        newGroupNames.add(m.slice(grpPrefix.length, -grpSuffix.length))
      }
    }
  }

  return {
    totalRows: preview.length,
    ready,
    warning,
    error,
    importableRows: ready + warning,
    likelyCreates,
    likelyUpdates,
    newCategoryNames: [...newCategoryNames].sort((a, b) => a.localeCompare(b, 'es')),
    newGroupNames: [...newGroupNames].sort((a, b) => a.localeCompare(b, 'es')),
  }
}

export type PreviewFilter = 'all' | 'ready' | 'warning' | 'error'

export function filterPreviewRows(rows: BulkImportPreviewRow[], f: PreviewFilter): BulkImportPreviewRow[] {
  if (f === 'all') return rows
  return rows.filter((r) => r.state === f)
}
