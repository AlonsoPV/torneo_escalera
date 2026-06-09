import { Navigate, Outlet } from 'react-router-dom'

import { RouteLoadingFallback } from '@/components/layout/RouteLoadingFallback'
import { isAdminRole } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'

export function RequireAdmin() {
  const initialized = useAuthStore((s) => s.initialized)
  const profile = useAuthStore((s) => s.profile)
  const profileLoading = useAuthStore((s) => s.profileLoading)

  if (!initialized || profileLoading) {
    return <RouteLoadingFallback />
  }

  if (!isAdminRole(profile?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
