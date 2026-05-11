import { Outlet, useLocation } from 'react-router-dom'

import { AppHeader } from '@/components/layout/AppHeader'
import { cn } from '@/lib/utils'

const playerStyleBg = (pathname: string) =>
  pathname === '/player' || pathname.startsWith('/player/')

export function AppShell() {
  const { pathname } = useLocation()
  const player = playerStyleBg(pathname)
  const dashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/')

  return (
    <div className={player ? 'flex min-h-svh flex-col bg-[#F6F3EE]' : 'flex min-h-svh flex-col bg-background'}>
      <AppHeader />
      <main
        className={cn(
          'mx-auto w-full max-w-7xl flex-1',
          player && 'px-3 py-4 sm:px-4 sm:py-6 md:px-6',
          dashboard && 'px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5 md:px-6',
          !player && !dashboard && 'px-3 py-3 sm:px-4 sm:py-4 md:px-6',
        )}
      >
        <Outlet />
      </main>
    </div>
  )
}
