import type { UserRole } from '@/types/database'

import { isValidImportNumericPassword, normalizeImportLabel } from '@/lib/userImportTemplate'

export type BulkImportParsedRow = {
  rowNumber: number
  externalId: string
  fullName: string
  role: string
  categoryName: string
  password: string
  groupName: string
  pj: string
  pts: string
}

export type BulkImportPreviewRow = {
  rowNumber: number
  externalId: string
  fullName: string
  role: string
  categoryName: string
  password: string
  groupName: string
  pj: number | null
  pts: number | null
  state: 'ready' | 'warning' | 'error'
  messages: string[]
}

export type BulkImportGroupMeta = {
  id: string
  name: string
  playerCount: number
  maxPlayers: number
}

export type BulkImportContext = {
  categoryNamesLower: Set<string>
  externalIdsInUse: Set<string>
  /** Vacío si no hay torneo seleccionado en la UI de importación */
  groupsByNorm: Map<string, BulkImportGroupMeta>
}

const ALLOWED_ROLES: UserRole[] = ['player', 'admin', 'super_admin']

function isAllowedRole(r: string): r is UserRole {
  return ALLOWED_ROLES.includes(r as UserRole)
}

/** Entero ≥ 0 o null si vacío; error si texto no vacío e inválido. */
function parseOptionalNonNegativeInt(raw: string, label: string): { value: number | null; error?: string } {
  const s = String(raw ?? '').trim()
  if (!s) return { value: null }
  if (!/^\d+$/.test(s)) {
    return { value: null, error: `${label}: indica un entero ≥ 0 o deja vacío.` }
  }
  const n = Number(s)
  if (!Number.isSafeInteger(n)) return { value: null, error: `${label}: número demasiado grande.` }
  return { value: n }
}

/** Entero con signo opcional o null si vacío (p. ej. puntos de ranking arrastrados). */
function parseOptionalSignedInt(raw: string, label: string): { value: number | null; error?: string } {
  const s = String(raw ?? '').trim()
  if (!s) return { value: null }
  if (!/^[+-]?\d+$/.test(s)) {
    return { value: null, error: `${label}: indica un entero (puede ser negativo) o deja vacío.` }
  }
  const n = Number(s)
  if (!Number.isSafeInteger(n)) return { value: null, error: `${label}: número demasiado grande.` }
  return { value: n }
}

export function buildBulkImportPreview(
  rows: BulkImportParsedRow[],
  context: BulkImportContext,
  options: {
    createMissingCategories: boolean
    createMissingGroups: boolean
    callerIsSuperAdmin: boolean
    importTournamentId: string | null
  },
): BulkImportPreviewRow[] {
  const preview: BulkImportPreviewRow[] = []
  const seenExt = new Set<string>()
  const passwordCounts = new Map<string, number>()
  const groupLive = new Map<string, number>()
  const draftGroupCounts = new Map<string, number>()
  for (const [, g] of context.groupsByNorm) {
    groupLive.set(g.id, g.playerCount)
  }

  for (const row of rows) {
    const messages: string[] = []
    const ext = row.externalId.trim()
    const name = row.fullName.trim()
    const pwd = String(row.password ?? '').trim()
    const cRaw = normalizeImportLabel(row.categoryName)
    const gRaw = normalizeImportLabel(row.groupName)
    const pjParse = parseOptionalNonNegativeInt(row.pj, 'PJ')
    const ptsParse = parseOptionalSignedInt(row.pts, 'Pts')
    if (pjParse.error) messages.push(pjParse.error)
    if (ptsParse.error) messages.push(ptsParse.error)

    let role = (row.role || 'player').trim().toLowerCase() as UserRole | string
    if (!role) role = 'player'
    if (!isAllowedRole(role)) {
      messages.push(`Rol no válido (“${row.role}”), se usará “player”.`)
      role = 'player'
    }
    if (role === 'super_admin' && !options.callerIsSuperAdmin) {
      messages.push('No puedes asignar super_admin desde la importación (requiere super admin).')
    }

    if (!ext) messages.push('ID obligatorio.')
    if (!name) messages.push('Nombre obligatorio.')
    if (!cRaw) messages.push('Categoría obligatoria.')
    const idExists = ext ? context.externalIdsInUse.has(ext.toLowerCase()) : false
    if (!pwd) {
      if (!idExists) {
        messages.push('Contraseña obligatoria (8 dígitos numéricos).')
      } else {
        messages.push('Sin contraseña en archivo: se conservará la contraseña actual del usuario.')
      }
    } else if (!isValidImportNumericPassword(pwd)) {
      messages.push('Contraseña: debe ser exactamente 8 dígitos (solo números).')
    } else {
      const n = (passwordCounts.get(pwd) ?? 0) + 1
      passwordCounts.set(pwd, n)
      if (n > 1) messages.push('La misma contraseña se repite en otra fila del archivo.')
    }
    if (idExists) {
      messages.push(
        'ID ya en el sistema: esta fila se procesará como actualización (solo se cambia la contraseña si indicas una nueva válida en el archivo).',
      )
    }

    const wantsGroup = Boolean(gRaw)
    if (wantsGroup && role !== 'player') {
      messages.push('El grupo solo se asigna a rol jugador; se ignorará el grupo en servidor para este usuario.')
    }
    if (wantsGroup && role === 'player') {
      if (!options.importTournamentId) {
        messages.push(`Para asignar el grupo “${gRaw}”, elige un torneo en “Torneo (opcional)”.`)
      } else {
        const key = gRaw.toLowerCase()
        const grp = context.groupsByNorm.get(key)
        if (grp) {
          const current = groupLive.get(grp.id) ?? grp.playerCount
          if (current >= grp.maxPlayers) {
            if (idExists) {
              messages.push(
                `Cupo: el grupo “${gRaw}” está al máximo (${grp.maxPlayers}); si este ID ya está inscrito ahí, no hace falta plaza libre.`,
              )
            } else {
              messages.push(`El grupo “${gRaw}” está lleno (${grp.maxPlayers} jugadores).`)
            }
          } else {
            groupLive.set(grp.id, current + 1)
          }
        } else if (options.createMissingGroups) {
          const curDraft = draftGroupCounts.get(key) ?? 0
          const maxNew = 5
          if (curDraft >= maxNew) {
            if (idExists) {
              messages.push(
                `Cupo: el grupo nuevo “${gRaw}” quedaría al máximo (${maxNew}) con este lote; si este ID ya pertenece a ese grupo, puede no aplicar.`,
              )
            } else {
              messages.push(
                `El grupo “${gRaw}” superaría el cupo (${maxNew} jugadores) al crearlo con las asignaciones de este archivo.`,
              )
            }
          } else {
            draftGroupCounts.set(key, curDraft + 1)
            messages.push(`Se creará el grupo “${gRaw}” en el torneo al importar.`)
          }
          if (context.groupsByNorm.size === 0) {
            messages.push('El torneo aún no tiene grupos; se crearán los indicados en el archivo.')
          }
        } else {
          messages.push(`El grupo “${gRaw}” no existe en el torneo seleccionado.`)
        }
      }
    }

    if (ext) {
      if (seenExt.has(ext.toLowerCase())) messages.push('ID duplicado en el archivo.')
      seenExt.add(ext.toLowerCase())
    }

    const catOk = context.categoryNamesLower.has(cRaw.toLowerCase())
    if (!catOk && !options.createMissingCategories) {
      messages.push(`La categoría “${cRaw}” no existe (activa “crear categorías faltantes” o créala antes).`)
    }
    if (!catOk && options.createMissingCategories) {
      messages.push(`Se creará la categoría “${cRaw}”.`)
    }

    let state: 'ready' | 'warning' | 'error' = 'ready'
    const hard = [
      'obligatorio',
      '8 dígitos',
      'duplicado en el archivo',
      'no existe (activa',
      'super_admin',
      'elige un torneo',
      'no hay grupos',
      'no existe en el torneo',
      'está lleno',
      'pj:',
      'pts:',
    ]
    if (messages.some((m) => hard.some((h) => m.toLowerCase().includes(h)))) state = 'error'
    else if (messages.length > 0) state = 'warning'

    preview.push({
      rowNumber: row.rowNumber,
      externalId: ext,
      fullName: name,
      password: pwd,
      role,
      categoryName: cRaw,
      groupName: gRaw,
      pj: pjParse.error ? null : pjParse.value,
      pts: ptsParse.error ? null : ptsParse.value,
      state,
      messages,
    })
  }

  return preview
}
