import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'

const fetchProfileMock = vi.fn()
const signOutMock = vi.fn()

vi.mock('@/lib/auth', () => ({
  fetchProfile: fetchProfileMock,
}))

vi.mock('@/lib/authSessionRecovery', () => ({
  recoverFromAuthError: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: signOutMock,
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}))

const { useAuthStore } = await import('@/stores/authStore')

function sessionFor(userId: string) {
  return {
    user: {
      id: userId,
      email: `${userId}@example.com`,
    },
  } as Session
}

function profileFor(userId: string, role = 'player') {
  return {
    id: userId,
    email: `${userId}@example.com`,
    full_name: `User ${userId}`,
    role,
    status: 'active',
  } as unknown as Profile
}

describe('authStore loading state', () => {
  beforeEach(() => {
    fetchProfileMock.mockReset()
    signOutMock.mockReset()
    useAuthStore.setState({
      session: null,
      user: null,
      profile: null,
      profileLoading: false,
      initialized: false,
    })
  })

  it('marks profile as loading until refreshProfile resolves', async () => {
    const profile = profileFor('u1', 'admin')
    fetchProfileMock.mockResolvedValueOnce(profile)

    useAuthStore.getState().setSession(sessionFor('u1'))

    expect(useAuthStore.getState().profileLoading).toBe(true)

    await useAuthStore.getState().refreshProfile()

    expect(fetchProfileMock).toHaveBeenCalledWith('u1')
    expect(useAuthStore.getState().profile).toBe(profile)
    expect(useAuthStore.getState().profileLoading).toBe(false)
  })

  it('keeps the loaded profile visible when the same session is refreshed', () => {
    const profile = profileFor('u1', 'admin')

    useAuthStore.getState().setSession(sessionFor('u1'))
    useAuthStore.getState().setProfile(profile)
    useAuthStore.setState({ profileLoading: false })

    useAuthStore.getState().setSession(sessionFor('u1'))

    expect(useAuthStore.getState().profile).toBe(profile)
    expect(useAuthStore.getState().profileLoading).toBe(false)
  })

  it('clears session, user, profile and loading state on local logout', () => {
    const profile = profileFor('u1')

    useAuthStore.getState().setSession(sessionFor('u1'))
    useAuthStore.getState().setProfile(profile)

    useAuthStore.getState().setSession(null)
    useAuthStore.getState().setProfile(null)

    expect(useAuthStore.getState().session).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().profile).toBeNull()
    expect(useAuthStore.getState().profileLoading).toBe(false)
  })
})
