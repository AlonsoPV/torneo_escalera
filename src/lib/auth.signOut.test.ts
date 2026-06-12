import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session } from '@supabase/supabase-js'

const signOutMock = vi.fn()
const clearSupabaseAuthStorageMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: signOutMock,
    },
  },
}))

vi.mock('@/lib/authSessionRecovery', () => ({
  clearSupabaseAuthStorage: clearSupabaseAuthStorageMock,
}))

const { useAuthStore, clearProfileRequestCache } = await import('@/stores/authStore')
const { signOutFromApp } = await import('@/lib/auth')

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com` },
  } as Session
}

describe('signOutFromApp', () => {
  beforeEach(() => {
    signOutMock.mockReset()
    clearSupabaseAuthStorageMock.mockReset()
    clearProfileRequestCache()
    useAuthStore.setState({
      session: null,
      user: null,
      profile: null,
      profileLoading: false,
      initialized: true,
    })
  })

  it('clears auth state and navigates before awaiting Supabase signOut', async () => {
    signOutMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ error: null }), 20)
        }),
    )

    useAuthStore.getState().setSession(sessionFor('u1'))

    const steps: string[] = []
    const queryClient = {
      cancelQueries: vi.fn(() => {
        steps.push('cancelQueries')
      }),
      clear: vi.fn(() => {
        steps.push('clear')
      }),
    }

    const promise = signOutFromApp({
      queryClient: queryClient as never,
      onNavigate: () => steps.push('navigate'),
    })

    expect(useAuthStore.getState().session).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(steps).toEqual(['cancelQueries', 'clear', 'navigate'])

    await promise

    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' })
    expect(clearSupabaseAuthStorageMock).not.toHaveBeenCalled()
  })

  it('clears Supabase storage if local signOut fails', async () => {
    signOutMock.mockResolvedValue({ error: new Error('storage error') })

    useAuthStore.getState().setSession(sessionFor('u1'))

    await expect(signOutFromApp()).rejects.toThrow('storage error')
    expect(clearSupabaseAuthStorageMock).toHaveBeenCalled()
  })
})
