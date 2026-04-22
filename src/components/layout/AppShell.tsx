import { Outlet } from 'react-router-dom'

import { AppHeader } from '@/components/layout/AppHeader'

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4">
        <Outlet />
      </main>
    </div>
  )
}
