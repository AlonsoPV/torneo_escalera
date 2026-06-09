import { Navigate, Outlet } from 'react-router-dom'

import { RouteLoadingFallback } from '@/components/layout/RouteLoadingFallback'
import { isAdminRole } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'

export function RequireAdmin() {
  const initialized = useAuthStore((s) => s.initialized)
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  const profileLoading = useAuthStore((s) => s.profileLoading)
  const hasAdminProfile = isAdminRole(profile?.role)

  if (!initialized || (session && !profile && profileLoading)) {
    return <RouteLoadingFallback />
  }

  if (!hasAdminProfile) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
