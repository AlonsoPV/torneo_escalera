import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { AdminBrandIcon, adminNavEntries, adminPathMatchesGroup, type AdminNavLinkItem } from './adminNav'

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()
  const pathname = location.pathname
  const BrandIcon = AdminBrandIcon

  /** Permite abrir la sección no activa para ver enlaces sin cambiar de página. */
  const [manualOpen, setManualOpen] = useState<Partial<Record<string, boolean>>>({})

  useEffect(() => {
    setManualOpen({})
  }, [pathname])

  const linkClassName = (isActive: boolean) =>
    cn(
      'flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-[#64748B] outline-none transition hover:bg-[#F6F3EE] hover:text-[#102A43] focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/40',
      isActive && 'bg-[#1F5A4C] text-white shadow-sm hover:bg-[#1F5A4C] hover:text-white',
    )

  const sectionExpanded = (label: string, items: readonly AdminNavLinkItem[]) => {
    const routeHere = adminPathMatchesGroup(pathname, items)
    if (routeHere) return true
    return manualOpen[label] === true
  }

  const toggleSection = (label: string, items: readonly AdminNavLinkItem[]) => {
    const routeHere = adminPathMatchesGroup(pathname, items)
    if (routeHere) return
    const open = sectionExpanded(label, items)
    setManualOpen((prev) => ({ ...prev, [label]: !open }))
  }

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
        {adminNavEntries.map((entry) => {
          const expanded = sectionExpanded(entry.label, entry.items)
          const routeHere = adminPathMatchesGroup(pathname, entry.items)

          return (
            <div key={entry.label} className="rounded-2xl border border-transparent">
              <button
                type="button"
                onClick={() => toggleSection(entry.label, entry.items)}
                className={cn(
                  'flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-[#102A43] outline-none transition hover:bg-[#F6F3EE] focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/40',
                  routeHere && 'bg-[#F6F3EE] text-[#1F5A4C]',
                )}
                aria-expanded={expanded}
                aria-controls={`admin-nav-section-${entry.label}`}
              >
                <span>{entry.label}</span>
                <ChevronDown
                  className={cn('size-4 shrink-0 text-[#64748B] transition-transform', expanded && 'rotate-180')}
                  aria-hidden
                />
              </button>

              {expanded ? (
                <div
                  id={`admin-nav-section-${entry.label}`}
                  className="mt-1 space-y-0.5 border-l-2 border-[#E2E8F0] pb-2 pl-3 ml-3"
                  role="group"
                  aria-label={`Opciones de ${entry.label}`}
                >
                  {entry.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        onClick={onNavigate}
                        className={({ isActive }) => linkClassName(isActive)}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="size-4 shrink-0 opacity-90" />
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
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>

      <div className="m-3 rounded-2xl border border-[#E2E8F0] bg-[#F6F3EE] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1F5A4C]">Modo admin</p>
        <p className="mt-1 text-xs leading-5 text-[#64748B]">Abre <strong>Torneo</strong> o <strong>Partidos</strong> para ver el resto de opciones.</p>
      </div>
    </aside>
  )
}
