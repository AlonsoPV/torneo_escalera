import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'

import { fetchProfile } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
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
  initialized: false,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
    }),
  setProfile: (profile) => set({ profile }),
  setInitialized: (initialized) => set({ initialized }),
  refreshProfile: async () => {
    const uid = get().user?.id
    if (!uid) {
      set({ profile: null })
      return
    }
    try {
      const profile = await fetchProfile(uid)
      set({ profile })
    } catch {
      set({ profile: null })
    }
  },
}))

export async function initAuthListener() {
  try {
    const { data } = await supabase.auth.getSession()
    useAuthStore.getState().setSession(data.session ?? null)
  } catch {
    useAuthStore.getState().setSession(null)
    useAuthStore.getState().setProfile(null)
  }
  await useAuthStore.getState().refreshProfile()
  useAuthStore.getState().setInitialized(true)

  supabase.auth.onAuthStateChange(async (_event, session) => {
    useAuthStore.getState().setSession(session)
    await useAuthStore.getState().refreshProfile()
  })
}
