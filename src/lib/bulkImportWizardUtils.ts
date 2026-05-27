import type { BulkImportPreviewRow } from '@/lib/bulkUserImportPreview'
import { MIN_PASSWORD_LENGTH } from '@/lib/passwordPolicy'

/** Documentación de columnas reconocidas (coincide con `mapSheetRow` en servicios). */
export const BULK_IMPORT_COLUMN_GUIDE = [
  {
    headers: 'id, ID, external_id',
    field: 'Identificador',
    required: true,
    hint: 'Obligatorio. ID externo o visible del jugador.',
  },
  {
    headers: 'nombre, name',
    field: 'Nombre completo',
    required: true,
    hint: 'Se muestra en el torneo y admin.',
  },
  {
    headers: 'correo_recuperacion',
    field: 'Correo de recuperación',
    required: false,
    hint: 'Correo real del usuario. No uses @mega-varonil.local. Vacío = no cambia (actualizaciones).',
  },
  {
    headers: 'Celular, Teléfono, Móvil',
    field: 'Número de celular',
    required: true,
    hint: 'Obligatorio. Se normaliza (solo dígitos, sin +52).',
  },
  {
    headers: 'contraseña, password',
    field: 'Contraseña',
    required: 'Condicional',
    hint: `Mínimo ${MIN_PASSWORD_LENGTH} caracteres para altas nuevas; vacía en actualización para no cambiar.`,
  },
  {
    headers: 'cuenta',
    field: 'Cuenta (activo / inactivo)',
    required: false,
    hint: 'Vacío o "activo" = puede iniciar sesión; "inactivo" = cuenta deshabilitada por admin.',
  },
  {
    headers: 'rol, role',
    field: 'Rol',
    required: true,
    hint: 'player, admin o super_admin (super_admin solo si tu cuenta es super admin).',
  },
  {
    headers: 'torneo, tournament',
    field: 'Torneo',
    required: false,
    hint: 'Opcional. Si coincide con un torneo existente, el asistente lo selecciona para validar grupos.',
  },
  {
    headers: 'categoria, Categoría',
    field: 'Categoría de jugador',
    required: false,
    hint: 'Opcional. Debe existir o marcarse “crear categorías faltantes”.',
  },
  {
    headers: 'grupo, group',
    field: 'Grupo',
    required: false,
    hint: 'Solo jugadores; requiere torneo seleccionado. El servidor puede crear el grupo.',
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
