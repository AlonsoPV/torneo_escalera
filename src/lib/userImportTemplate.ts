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
