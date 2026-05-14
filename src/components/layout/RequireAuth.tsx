import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { RouteLoadingFallback } from '@/components/layout/RouteLoadingFallback'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function RequireAuth() {
  const location = useLocation()
  const initialized = useAuthStore((s) => s.initialized)
  const session = useAuthStore((s) => s.session)

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-2 p-4 text-sm">
        <p className="font-medium">Supabase no está configurado.</p>
        <p className="text-muted-foreground">
          Copia <code className="rounded bg-muted px-1">.env.example</code> a{' '}
          <code className="rounded bg-muted px-1">.env</code> y define{' '}
          <code className="rounded bg-muted px-1">VITE_SUPABASE_URL</code> y{' '}
          <code className="rounded bg-muted px-1">VITE_SUPABASE_ANON_KEY</code>.
        </p>
      </div>
    )
  }

  if (!initialized) {
    return <RouteLoadingFallback />
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
