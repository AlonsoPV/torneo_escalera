import type { UserRole } from '@/types/database'

import { normalizePhone } from '@/lib/phone'
import { isValidImportPassword, normalizeImportLabel } from '@/lib/userImportTemplate'
import { MIN_PASSWORD_LENGTH } from '@/lib/passwordPolicy'

export type BulkImportParsedRow = {
  rowNumber: number
  externalId: string
  phone: string
  fullName: string
  role: string
  tournamentName: string
  categoryName: string
  password: string
  groupName: string
  recoveryEmail: string
  accountCuenta: string
}

export type BulkImportPreviewRow = {
  rowNumber: number
  externalId: string
  phone: string
  fullName: string
  role: string
  categoryName: string
  password: string
  groupName: string
  recoveryEmail: string
  accountStatus: 'active' | 'inactive'
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
  phonesInUse: Set<string>
  /** Vacío si no hay torneo seleccionado en la UI de importación */
  groupsByNorm: Map<string, BulkImportGroupMeta>
}

const ALLOWED_ROLES: UserRole[] = ['player', 'admin', 'super_admin']

function isAllowedRole(r: string): r is UserRole {
  return ALLOWED_ROLES.includes(r as UserRole)
}

/** Vacío → activo. */
export function normalizeImportAccountCuenta(raw: string): 'active' | 'inactive' | 'invalid' {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!s || s === 'activo' || s === 'active') return 'active'
  if (s === 'inactivo' || s === 'inactive') return 'inactive'
  return 'invalid'
}

function validateRecoveryEmailForImport(raw: string): { ok: true } | { ok: false; error: string } {
  const s = raw.trim()
  if (!s) return { ok: true }
  if (s.toLowerCase().endsWith('@mega-varonil.local')) {
    return {
      ok: false,
      error: 'Correo de recuperación no puede usar el dominio técnico @mega-varonil.local.',
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    return { ok: false, error: 'Correo de recuperación inválido.' }
  }
  return { ok: true }
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
  const seenPhones = new Set<string>()
  const passwordCounts = new Map<string, number>()
  const groupLive = new Map<string, number>()
  const draftGroupCounts = new Map<string, number>()
  for (const [, g] of context.groupsByNorm) {
    groupLive.set(g.id, g.playerCount)
  }

  for (const row of rows) {
    const messages: string[] = []
    const ext = row.externalId.trim()
    const phoneRaw = row.phone.trim()
    const phoneNorm = normalizePhone(phoneRaw)
    const phoneDigits = phoneNorm.ok ? phoneNorm.digits : ''
    const name = row.fullName.trim()
    const pwd = String(row.password ?? '').trim()
    const cRawFull = normalizeImportLabel(row.categoryName)
    /** Categoría vacía tras normalizar etiqueta: tratamos como sin categoría. */
    const cRaw = cRawFull.replace(/\s+/g, '').length === 0 ? '' : cRawFull
    const gRaw = normalizeImportLabel(row.groupName)
    const recoveryRaw = row.recoveryEmail.trim()
    const acctParse = normalizeImportAccountCuenta(row.accountCuenta)
    if (acctParse === 'invalid') {
      messages.push('Cuenta: indica "activo" o "inactivo" (vacío = activo).')
    }

    const recVal = validateRecoveryEmailForImport(recoveryRaw)
    if (!recVal.ok) messages.push(recVal.error)

    const roleRaw = (row.role ?? '').trim().toLowerCase()
    if (!roleRaw) {
      messages.push('Rol obligatorio (player, admin o super_admin).')
    } else if (!isAllowedRole(roleRaw)) {
      messages.push(`Rol no válido (“${row.role}”). Usa player, admin o super_admin.`)
    }
    let role: UserRole | string = roleRaw
    if (!isAllowedRole(role)) {
      role = 'player' as UserRole
    }
    if (isAllowedRole(role) && role === 'super_admin' && !options.callerIsSuperAdmin) {
      messages.push('No puedes asignar super_admin desde la importación (requiere super admin).')
    }

    if (!phoneRaw) {
      messages.push('Celular obligatorio.')
    } else if (!phoneNorm.ok) {
      messages.push(phoneNorm.error)
    }

    if (!name) messages.push('Nombre obligatorio.')

    const idExists = ext ? context.externalIdsInUse.has(ext.toLowerCase()) : false
    const phoneExists = phoneDigits ? context.phonesInUse.has(phoneDigits) : false

    if (!ext) {
      if (phoneExists) {
        messages.push('Sin ID en archivo: se actualizará por celular y se conservará el ID actual.')
      } else {
        messages.push('ID obligatorio para altas nuevas.')
      }
    }

    if (!pwd) {
      if (!idExists && !phoneExists) {
        messages.push(`Contraseña obligatoria (mínimo ${MIN_PASSWORD_LENGTH} caracteres) para altas nuevas.`)
      } else {
        messages.push('Sin contraseña en archivo: se conservará la contraseña actual del usuario.')
      }
    } else if (!isValidImportPassword(pwd)) {
      messages.push(`Contraseña: mínimo ${MIN_PASSWORD_LENGTH} caracteres.`)
    } else {
      const n = (passwordCounts.get(pwd) ?? 0) + 1
      passwordCounts.set(pwd, n)
      if (n > 1) messages.push('La misma contraseña se repite en otra fila del archivo.')
    }

    if (idExists || phoneExists) {
      messages.push(
        'Este registro ya existe en el sistema (por ID y/o celular): se procesará como actualización si no hay conflictos.',
      )
    }

    if (phoneDigits) {
      if (seenPhones.has(phoneDigits)) messages.push('Celular duplicado en el archivo.')
      seenPhones.add(phoneDigits)
    }

    if (ext) {
      if (seenExt.has(ext.toLowerCase())) messages.push('ID duplicado en el archivo.')
      seenExt.add(ext.toLowerCase())
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
            if (idExists || phoneExists) {
              messages.push(
                `Cupo: el grupo “${gRaw}” está al máximo (${grp.maxPlayers}); si este jugador ya está inscrito ahí, puede no aplicar.`,
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
            if (idExists || phoneExists) {
              messages.push(
                `Cupo: el grupo nuevo “${gRaw}” quedaría al máximo (${maxNew}) con este lote; si este jugador ya pertenece a ese grupo, puede no aplicar.`,
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

    if (cRaw) {
      const catOk = context.categoryNamesLower.has(cRaw.toLowerCase())
      if (!catOk && !options.createMissingCategories) {
        messages.push(`La categoría “${cRaw}” no existe (activa “crear categorías faltantes” o créala antes).`)
      }
      if (!catOk && options.createMissingCategories) {
        messages.push(`Se creará la categoría “${cRaw}”.`)
      }
    }

    const accountStatus: 'active' | 'inactive' = acctParse === 'inactive' ? 'inactive' : 'active'

    let state: 'ready' | 'warning' | 'error' = 'ready'
    const hard = [
      'obligatorio',
      'caracteres',
      'duplicado en el archivo',
      'no existe (activa',
      'super_admin',
      'elige un torneo',
      'no hay grupos',
      'no existe en el torneo',
      'está lleno',
      'no puede tener más',
      'debe tener al menos',
      'no válido',
      'correo de recuperación',
      'dominio técnico',
      'cuenta:',
    ]
    if (messages.some((m) => hard.some((h) => m.toLowerCase().includes(h)))) state = 'error'
    else if (messages.length > 0) state = 'warning'

    preview.push({
      rowNumber: row.rowNumber,
      externalId: ext,
      phone: phoneDigits || phoneRaw,
      fullName: name,
      password: pwd,
      role: isAllowedRole(role) ? role : 'player',
      categoryName: cRaw,
      groupName: gRaw,
      recoveryEmail: recoveryRaw,
      accountStatus,
      state,
      messages,
    })
  }

  return preview
}
