/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { IndexRedirect } from '@/components/layout/IndexRedirect'
import { RequireAdmin } from '@/components/layout/RequireAdmin'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'

function RedirectLegacyAdminResultsToMatches() {
  const { search } = useLocation()
  return <Navigate to={`/admin/matches${search}`} replace />
}

const TournamentSimulationPage = lazy(() =>
  import('@/pages/simulation/TournamentSimulationPage').then((m) => ({ default: m.TournamentSimulationPage })),
)
const TournamentDashboardPage = lazy(() =>
  import('@/pages/dashboard/TournamentDashboardPage').then((m) => ({ default: m.TournamentDashboardPage })),
)
const PlayerDashboardPage = lazy(() =>
  import('@/pages/player/PlayerDashboardPage').then((m) => ({ default: m.PlayerDashboardPage })),
)
const PlayerAccountPage = lazy(() =>
  import('@/pages/player/PlayerAccountPage').then((m) => ({ default: m.PlayerAccountPage })),
)
const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
)
const AdminOverviewPage = lazy(() =>
  import('@/pages/admin/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })),
)
const AdminTournamentsPage = lazy(() =>
  import('@/pages/admin/AdminTournamentsPage').then((m) => ({ default: m.AdminTournamentsPage })),
)
const NextTournamentPage = lazy(() =>
  import('@/pages/admin/NextTournamentPage').then((m) => ({ default: m.NextTournamentPage })),
)
const AdminRulesPage = lazy(() =>
  import('@/pages/admin/AdminRulesPage').then((m) => ({ default: m.AdminRulesPage })),
)
const AdminGroupsPage = lazy(() =>
  import('@/pages/admin/AdminGroupsPage').then((m) => ({ default: m.AdminGroupsPage })),
)
const AdminMatchResultsImportPage = lazy(() =>
  import('@/pages/admin/AdminMatchResultsImportPage').then((m) => ({ default: m.AdminMatchResultsImportPage })),
)
const AdminMatchesPage = lazy(() =>
  import('@/pages/admin/AdminMatchesPage').then((m) => ({ default: m.AdminMatchesPage })),
)
const AdminUsersPage = lazy(() =>
  import('@/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
)
const AdminNotificationsPage = lazy(() =>
  import('@/pages/admin/AdminNotificationsPage').then((m) => ({ default: m.AdminNotificationsPage })),
)
const AdminExportsPage = lazy(() =>
  import('@/pages/admin/AdminExportsPage').then((m) => ({ default: m.AdminExportsPage })),
)
const AdminSettingsPage = lazy(() =>
  import('@/pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })),
)

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/auth/reset-password', element: <ResetPasswordPage /> },
  { path: '/register', element: <Navigate to="/login" replace /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <IndexRedirect /> },
      // /profile/* (p. ej. /profile/academy/edit): enlaces legacy → panel jugador
      {
        path: 'profile/*',
        element: <Navigate to="/player" replace />,
      },
      {
        element: <RequireAuth />,
        children: [
          { path: 'simulation', element: <TournamentSimulationPage /> },
          { path: 'dashboard', element: <TournamentDashboardPage /> },
          { path: 'player', element: <PlayerDashboardPage /> },
          { path: 'player/cuenta', element: <PlayerAccountPage /> },
          { path: 'tournaments/:tournamentId/:tournamentSlug', element: <Navigate to="/dashboard" replace /> },
          { path: 'tournaments/:tournamentId', element: <Navigate to="/dashboard" replace /> },
          { path: 'tournaments', element: <Navigate to="/dashboard" replace /> },
          {
            path: 'admin',
            element: <RequireAdmin />,
            children: [
              {
                element: <AdminDashboardPage />,
                children: [
                  { index: true, element: <Navigate to="/admin/overview" replace /> },
                  { path: 'overview', element: <AdminOverviewPage /> },
                  { path: 'tournaments', element: <AdminTournamentsPage /> },
                  { path: 'next-tournament', element: <NextTournamentPage /> },
                  { path: 'rules', element: <AdminRulesPage /> },
                  { path: 'groups', element: <AdminGroupsPage /> },
                  { path: 'matches/import', element: <AdminMatchResultsImportPage /> },
                  { path: 'matches', element: <AdminMatchesPage /> },
                  { path: 'results/import', element: <Navigate to="/admin/matches/import" replace /> },
                  { path: 'results', element: <RedirectLegacyAdminResultsToMatches /> },
                  { path: 'users', element: <AdminUsersPage /> },
                  { path: 'notifications', element: <AdminNotificationsPage /> },
                  { path: 'exports', element: <AdminExportsPage /> },
                  { path: 'settings', element: <AdminSettingsPage /> },
                  { path: '*', element: <Navigate to="/admin/overview" replace /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])
