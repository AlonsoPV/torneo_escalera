export type NormalizePhoneResult =
  | { ok: true; digits: string }
  | { ok: false; error: string }

/** Elimina espacios, guiones, paréntesis y prefijos México (+52 / 52). Deja solo dígitos (10–13). */
export function normalizePhone(raw: string): NormalizePhoneResult {
  let s = String(raw ?? '').trim()
  s = s.replace(/[\s\-().]/g, '')
  if (s.startsWith('+52')) {
    s = s.slice(3)
  }
  let digits = s.replace(/\D/g, '')
  while (digits.startsWith('52') && digits.length > 10) {
    digits = digits.slice(2)
  }
  if (digits.length < 10) {
    return { ok: false, error: 'El número debe tener al menos 10 dígitos.' }
  }
  if (digits.length > 13) {
    return { ok: false, error: 'El número no puede tener más de 13 dígitos.' }
  }
  return { ok: true, digits }
}

export function technicalAuthEmailFromDigits(digits: string): string {
  return `${digits}@mega-varonil.local`
}
