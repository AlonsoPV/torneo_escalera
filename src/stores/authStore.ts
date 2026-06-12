import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'

import { fetchProfile } from '@/lib/auth'
import { recoverFromAuthError } from '@/lib/authSessionRecovery'
import { logPerfMetric, measureAsync } from '@/lib/performanceDiagnostics'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  profileLoading: boolean
  initialized: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  setInitialized: (v: boolean) => void
  refreshProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  profileLoading: false,
  initialized: false,
  setSession: (session) => {
    const previousUserId = get().user?.id ?? null
    const nextUserId = session?.user?.id ?? null
    const sameUser = Boolean(nextUserId && previousUserId === nextUserId)
    const currentProfile = get().profile
    set({
      session,
      user: session?.user ?? null,
      profile: sameUser ? currentProfile : null,
      profileLoading: Boolean(nextUserId && (!sameUser || !currentProfile)),
    })
  },
  setProfile: (profile) => set({ profile, profileLoading: false }),
  setInitialized: (initialized) => set({ initialized }),
  refreshProfile: async () => {
    const uid = get().user?.id
    if (!uid) {
      set({ profile: null, profileLoading: false })
      return
    }
    set({ profileLoading: true })
    try {
      const profile = await getProfileOnce(uid)
      // Evita aplicar un perfil obsoleto si hubo cierre de sesión durante el fetch
      if (get().user?.id !== uid) return
      if (profile?.status === 'inactive') {
        await supabase.auth.signOut({ scope: 'local' })
        clearProfileRequestCache()
        set({ session: null, user: null, profile: null, profileLoading: false })
        return
      }
      set({ profile })
    } catch {
      if (get().user?.id === uid) set({ profile: null })
    } finally {
      if (get().user?.id === uid) set({ profileLoading: false })
    }
  },
}))

const profileRequests = new Map<string, Promise<Profile | null>>()

/** Limpia deduplicación de perfil al cerrar sesión (evita datos obsoletos al re-entrar). */
export function clearProfileRequestCache(): void {
  profileRequests.clear()
}

function getProfileOnce(userId: string): Promise<Profile | null> {
  const existing = profileRequests.get(userId)
  if (existing) return existing

  const request = measureAsync('auth.profile', () => fetchProfile(userId), { user: 'current' }).finally(() => {
    profileRequests.delete(userId)
  })
  profileRequests.set(userId, request)
  return request
}

export async function initAuthListener() {
  const initStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  try {
    const { data, error } = await measureAsync('auth.getSession', () => supabase.auth.getSession())
    if (error) await recoverFromAuthError(error)
    useAuthStore.getState().setSession(data.session ?? null)
  } catch (e) {
    await recoverFromAuthError(e)
    useAuthStore.getState().setSession(null)
    useAuthStore.getState().setProfile(null)
  }
  useAuthStore.getState().setInitialized(true)
  logPerfMetric('auth.initialized', (typeof performance !== 'undefined' ? performance.now() : Date.now()) - initStartedAt)
  void useAuthStore.getState().refreshProfile().catch((e) => {
    void recoverFromAuthError(e)
  })

  supabase.auth.onAuthStateChange(async (event, session) => {
    useAuthStore.getState().setSession(session)
    if (event === 'SIGNED_OUT' || !session) {
      clearProfileRequestCache()
      useAuthStore.getState().setProfile(null)
      return
    }
    try {
      await useAuthStore.getState().refreshProfile()
    } catch (e) {
      void recoverFromAuthError(e)
    }
  })
}
