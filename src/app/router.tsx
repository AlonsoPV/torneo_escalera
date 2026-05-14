import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { IndexRedirect } from '@/components/layout/IndexRedirect'
import { RequireAdmin } from '@/components/layout/RequireAdmin'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminExportsPage } from '@/pages/admin/AdminExportsPage'
import { AdminGroupsPage } from '@/pages/admin/AdminGroupsPage'
import { AdminMatchesPage } from '@/pages/admin/AdminMatchesPage'
import { AdminNotificationsPage } from '@/pages/admin/AdminNotificationsPage'
import { AdminOverviewPage } from '@/pages/admin/AdminOverviewPage'
import { AdminMatchResultsImportPage } from '@/pages/admin/AdminMatchResultsImportPage'
import { AdminResultsPage } from '@/pages/admin/AdminResultsPage'
import { AdminRulesPage } from '@/pages/admin/AdminRulesPage'
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage'
import { AdminTournamentsPage } from '@/pages/admin/AdminTournamentsPage'
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage'
import { NextTournamentPage } from '@/pages/admin/NextTournamentPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { TournamentDashboardPage } from '@/pages/dashboard/TournamentDashboardPage'
import { TournamentSimulationPage } from '@/pages/simulation/TournamentSimulationPage'
import { PlayerAccountPage } from '@/pages/player/PlayerAccountPage'
import { PlayerDashboardPage } from '@/pages/player/PlayerDashboardPage'

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
                  { path: 'matches', element: <AdminMatchesPage /> },
                  { path: 'results', element: <AdminResultsPage /> },
                  { path: 'results/import', element: <AdminMatchResultsImportPage /> },
                  { path: 'users', element: <AdminUsersPage /> },
                  { path: 'notifications', element: <AdminNotificationsPage /> },
                  { path: 'exports', element: <AdminExportsPage /> },
                  { path: 'settings', element: <AdminSettingsPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])
