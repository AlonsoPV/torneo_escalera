/** Normaliza etiqueta de categoría o grupo para mostrar y comparar (title case por palabra). */
export function normalizeImportLabel(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

import { isPasswordLongEnough, MIN_PASSWORD_LENGTH } from '@/lib/passwordPolicy'

/** Contraseña en carga masiva: mínimo {@link MIN_PASSWORD_LENGTH} caracteres. */
export function isValidImportPassword(s: string): boolean {
  return isPasswordLongEnough(s)
}
