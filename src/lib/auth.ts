import type { AuthError } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'

import { clearSupabaseAuthStorage } from '@/lib/authSessionRecovery'
import { supabase } from '@/lib/supabase'
import { isAdminRole } from '@/lib/permissions'
import { formatAuthPasswordError } from '@/lib/passwordPolicy'
import { invokeResolveAuthEmailByPhone } from '@/services/authEdge'
import { clearProfileRequestCache, useAuthStore } from '@/stores/authStore'
import type { Profile } from '@/types/database'

const GENERIC_CREDENTIALS_ERROR = 'Número o contraseña incorrectos.'

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

function mapAuthPasswordError(error: AuthError): Error {
  const m = (error.message ?? '').toLowerCase()
  if (
    error.code === 'weak_password' ||
    m.includes('password should be') ||
    m.includes('too short')
  ) {
    return new Error(formatAuthPasswordError(error.message))
  }
  if (
    m.includes('invalid login credentials') ||
    m.includes('invalid credentials') ||
    m.includes('wrong password') ||
    m.includes('email not confirmed')
  ) {
    return new Error(GENERIC_CREDENTIALS_ERROR)
  }
  if (m.includes('@') || m.includes('email')) {
    return new Error(GENERIC_CREDENTIALS_ERROR)
  }
  return new Error(error.message || GENERIC_CREDENTIALS_ERROR)
}

async function signInWithPasswordInternal(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw mapAuthPasswordError(error)
  return data
}

/** Destino tras login: mismo criterio que IndexRedirect, respetando `from` solo en rutas permitidas por rol. */
export function resolvePostLoginPath(profile: Profile | null, fromPath: string): string {
  const admin = profile ? isAdminRole(profile.role) : false
  const fallback = admin ? '/admin' : '/player'
  if (!fromPath || fromPath === '/') return fallback
  if (admin && (fromPath.startsWith('/admin') || fromPath === '/dashboard')) return fromPath
  if (!admin && !fromPath.startsWith('/admin') && (fromPath.startsWith('/player') || fromPath === '/dashboard')) {
    return fromPath
  }
  return fallback
}

/** Login por celular: resuelve email en Auth vía Edge Function (solo servidor) y llama a signInWithPassword. */
export async function signInWithPhone(phone: string, password: string) {
  const authEmail = await invokeResolveAuthEmailByPhone(phone)
  return signInWithPasswordInternal(authEmail, password)
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
  if (error) throw mapAuthPasswordError(error)
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw error
}

export type SignOutFromAppOptions = {
  queryClient?: QueryClient
  /** Navegación SPA inmediata tras limpiar estado en memoria. */
  onNavigate?: () => void
}

/**
 * Cierre de sesión optimista: limpia store y navega al login de inmediato;
 * luego persiste signOut local en Supabase (sin round-trip global).
 */
export async function signOutFromApp(options?: SignOutFromAppOptions): Promise<void> {
  clearProfileRequestCache()
  useAuthStore.getState().setSession(null)
  useAuthStore.getState().setProfile(null)

  options?.queryClient?.cancelQueries()
  options?.queryClient?.clear()
  options?.onNavigate?.()

  try {
    await signOut()
  } catch (error) {
    clearSupabaseAuthStorage()
    throw error
  }
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
  if (error) throw mapAuthPasswordError(error)
}
