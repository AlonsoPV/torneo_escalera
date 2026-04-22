import { Navigate, Outlet } from 'react-router-dom'

import { isAdminRole } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'

export function RequireAdmin() {
  const profile = useAuthStore((s) => s.profile)

  if (!isAdminRole(profile?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
