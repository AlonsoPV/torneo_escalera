import { createClient } from '@supabase/supabase-js'
import { processLock } from '@supabase/auth-js'

import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * En desarrollo, React Strict Mode monta y desmonta dos veces; el candado por
 * defecto (Web Locks / `navigator.locks`) puede quedar huérfano y gotrue-js
 * avisa tras `lockAcquireTimeout`. `processLock` coordina solo dentro del
 * proceso actual (sin API del navegador entre pestañas), suficiente en dev.
 * En producción se mantiene el candado por defecto para varias pestañas.
 */
export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder',
  {
    global: {
      fetch: fetchWithTimeout,
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      /** Necesario para enlaces de recuperación (hash / PKCE en la URL). */
      detectSessionInUrl: true,
      ...(import.meta.env.DEV ? { lock: processLock } : {}),
    },
  },
)
