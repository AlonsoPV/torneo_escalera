import { Navigate } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { isAdminRole } from '@/lib/permissions'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/** Con sesión: admin/super_admin → /admin; resto → /player. Sin sesión → /login. */
export function IndexRedirect() {
  const initialized = useAuthStore((s) => s.initialized)
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)

  if (!isSupabaseConfigured) {
    return <Navigate to="/login" replace />
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
    if (profile && isAdminRole(profile.role)) {
      return <Navigate to="/admin" replace />
    }
    return <Navigate to="/player" replace />
  }

  return <Navigate to="/login" replace />
}
