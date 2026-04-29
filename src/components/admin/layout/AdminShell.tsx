import { Outlet } from 'react-router-dom'

import { AdminSidebar } from './AdminSidebar'
import { AdminTopbar } from './AdminTopbar'

/** Altura aproximada del header global (AppHeader) para alinear min-height del panel. */
const ADMIN_MAIN_MIN_H = 'min-h-[calc(100svh-3.75rem)]'

export function AdminShell() {
  return (
    <div
      className={`-mx-3 -my-3 ${ADMIN_MAIN_MIN_H} bg-[#F6F3EE] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-4 sm:-my-4 md:-mx-6`}
    >
      <div className={`grid min-h-0 md:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)] md:items-stretch ${ADMIN_MAIN_MIN_H}`}>
        <div className="relative hidden min-h-0 md:block">
          <AdminSidebar />
        </div>
        <div className="flex min-h-0 min-w-0 flex-col">
          <AdminTopbar />
          <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
