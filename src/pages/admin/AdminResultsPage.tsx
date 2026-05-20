import { Navigate, useLocation } from 'react-router-dom'

/** Compatibilidad: `/admin/results` → `/admin/matches` (misma query conservada). */
export function AdminResultsPage() {
  const { search } = useLocation()
  return <Navigate to={`/admin/matches${search}`} replace />
}
