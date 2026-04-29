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
import { AdminResultsPage } from '@/pages/admin/AdminResultsPage'
import { AdminRulesPage } from '@/pages/admin/AdminRulesPage'
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage'
import { AdminTournamentsPage } from '@/pages/admin/AdminTournamentsPage'
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { TournamentDetailPage } from '@/pages/tournaments/TournamentDetailPage'
import { TournamentSimulationPage } from '@/pages/simulation/TournamentSimulationPage'
import { PlayerDashboardPage } from '@/pages/player/PlayerDashboardPage'
import { TournamentsListPage } from '@/pages/tournaments/TournamentsListPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <IndexRedirect /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'simulation', element: <TournamentSimulationPage /> },
      // /profile/* (p. ej. /profile/academy/edit): enlaces legacy → panel jugador
      {
        path: 'profile/*',
        element: <Navigate to="/player" replace />,
      },
      {
        element: <RequireAuth />,
        children: [
          { path: 'player', element: <PlayerDashboardPage /> },
          { path: 'tournaments', element: <TournamentsListPage /> },
          { path: 'tournaments/:tournamentId/:tournamentSlug', element: <TournamentDetailPage /> },
          { path: 'tournaments/:tournamentId', element: <TournamentDetailPage /> },
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
                  { path: 'rules', element: <AdminRulesPage /> },
                  { path: 'groups', element: <AdminGroupsPage /> },
                  { path: 'matches', element: <AdminMatchesPage /> },
                  { path: 'results', element: <AdminResultsPage /> },
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
