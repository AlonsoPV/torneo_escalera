/** Texto para UI: oculta correos técnicos de autenticación. */
export function formatRecoveryEmailDisplay(email: string | null | undefined): string {
  const t = email?.trim()
  if (!t) return 'Sin correo'
  if (t.toLowerCase().endsWith('@mega-varonil.local')) return 'Sin correo'
  return t
}

export function recoveryEmailComplete(profile: {
  email: string | null | undefined
  must_complete_email?: boolean | null
}): boolean {
  if (profile.must_complete_email) return false
  return formatRecoveryEmailDisplay(profile.email) !== 'Sin correo'
}
