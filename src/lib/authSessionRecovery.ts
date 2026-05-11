import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/** Detecta refresh inválido / sesión corrupta en errores de Supabase Auth. */
export function isInvalidRefreshTokenError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()
  return msg.includes('invalid refresh token') || msg.includes('refresh token not found')
}

/**
 * Limpia sesión local y redirige a login si la sesión no es recuperable.
 * @returns true si se aplicó recuperación (no re-lanzar el error al caller).
 */
export async function recoverFromAuthError(error: unknown): Promise<boolean> {
  if (!isInvalidRefreshTokenError(error)) return false
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* ignore */
  }
  try {
    const prefix = 'sb-'
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) keysToRemove.push(k)
    }
    for (const k of keysToRemove) localStorage.removeItem(k)
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(prefix)) sessionStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
  useAuthStore.getState().setSession(null)
  useAuthStore.getState().setProfile(null)
  useAuthStore.getState().setInitialized(true)
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login')
  }
  return true
}

/** Limpieza manual (p. ej. desde login). */
export async function clearLocalAuthAndGoToLogin(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* ignore */
  }
  try {
    const rm: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-')) rm.push(k)
    }
    for (const k of rm) localStorage.removeItem(k)
    const rs: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith('sb-')) rs.push(k)
    }
    for (const k of rs) sessionStorage.removeItem(k)
  } catch {
    /* ignore */
  }
  useAuthStore.getState().setSession(null)
  useAuthStore.getState().setProfile(null)
  useAuthStore.getState().setInitialized(true)
  window.location.assign('/login')
}
