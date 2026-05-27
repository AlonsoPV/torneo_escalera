/** Supabase Auth no acepta contraseñas de menos de 6 caracteres. */
export const MIN_PASSWORD_LENGTH = 6

export function isPasswordLongEnough(password: string): boolean {
  return String(password ?? '').trim().length >= MIN_PASSWORD_LENGTH
}

export function passwordMinLengthMessage(): string {
  return `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`
}

export function passwordMinLengthError(prefix = 'La contraseña'): string {
  return `${prefix} debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
}

/** Traduce errores de GoTrue (p. ej. weak_password en inglés) al mensaje de la app. */
export function formatAuthPasswordError(message: string): string {
  const m = String(message ?? '').trim()
  if (!m) return passwordMinLengthError()
  if (/password should be at least/i.test(m) || /weak_password/i.test(m) || /too short/i.test(m)) {
    return passwordMinLengthError()
  }
  return m
}
