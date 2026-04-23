import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { IndexRedirect } from '@/components/layout/IndexRedirect'
import { RequireAdmin } from '@/components/layout/RequireAdmin'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { AdminPage } from '@/pages/admin/AdminPage'
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
          { path: 'tournaments/:id', element: <TournamentDetailPage /> },
          {
            path: 'admin',
            element: <RequireAdmin />,
            children: [{ index: true, element: <AdminPage /> }],
          },
        ],
      },
    ],
  },
])
