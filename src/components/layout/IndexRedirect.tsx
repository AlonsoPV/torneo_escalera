import { Navigate } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/** Entrada /: con sesión → panel del jugador; sin sesión → inicio general. */
export function IndexRedirect() {
  const initialized = useAuthStore((s) => s.initialized)
  const session = useAuthStore((s) => s.session)

  if (!isSupabaseConfigured) {
    return <Navigate to="/simulation" replace />
  }

  if (!initialized) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full max-w-2xl" />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/player" replace />
  }

  return <Navigate to="/simulation" replace />
}
