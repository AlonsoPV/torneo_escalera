import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** URL absoluta a la que Supabase redirige tras el enlace del correo (whitelist en el proyecto Supabase). */
export function getPasswordResetRedirectUrl(): string {
  if (typeof window === 'undefined') return ''
  const base = import.meta.env.BASE_URL ?? '/'
  const prefix = base === '/' ? '' : base.replace(/\/$/, '')
  return `${window.location.origin}${prefix}/auth/reset-password`
}

export async function requestPasswordReset(email: string) {
  const redirectTo = getPasswordResetRedirectUrl()
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  })
  if (error) throw error
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
