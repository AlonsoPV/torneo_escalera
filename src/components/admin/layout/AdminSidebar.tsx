import { NavLink } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { AdminBrandIcon, adminNavItems } from './adminNav'

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const BrandIcon = AdminBrandIcon

  return (
    <aside className="flex h-full min-h-[calc(100svh-3.75rem)] flex-col border-r border-[#E2E8F0] bg-white/90 md:sticky md:top-0 md:max-h-[calc(100svh-3.75rem)] md:overflow-y-auto md:overscroll-y-contain">
      <div className="flex items-center gap-3 border-b border-[#E2E8F0] px-5 py-5">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-[#1F5A4C] text-white shadow-sm">
          <BrandIcon className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[#102A43]">Administración</p>
          <p className="text-xs text-[#64748B]">Panel del torneo</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navegación de administración">
        {adminNavItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium text-[#64748B] outline-none transition hover:bg-[#F6F3EE] hover:text-[#102A43] focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/40',
                  isActive && 'bg-[#1F5A4C] text-white shadow-sm hover:bg-[#1F5A4C] hover:text-white',
                )
              }
            >
              <span className="flex items-center gap-3">
                <Icon className="size-4" />
                {item.label}
              </span>
              {'upcoming' in item && item.upcoming ? (
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  Próximamente
                </Badge>
              ) : null}
            </NavLink>
          )
        })}
      </nav>

      <div className="m-3 rounded-2xl border border-[#E2E8F0] bg-[#F6F3EE] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1F5A4C]">Modo admin</p>
        <p className="mt-1 text-xs leading-5 text-[#64748B]">
          Opera grupos, cruces y marcadores desde un solo lugar.
        </p>
      </div>
    </aside>
  )
}
