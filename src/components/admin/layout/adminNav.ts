import type { LucideIcon } from 'lucide-react'
import {
  ArrowRightLeft,
  BarChart3,
  Bell,
  CalendarClock,
  Download,
  Flag,
  LayoutDashboard,
  Settings,
  Settings2,
  ShieldCheck,
  Tags,
  Trophy,
  Upload,
  Users,
} from 'lucide-react'

export type AdminNavLinkItem = {
  label: string
  href: string
  icon: LucideIcon
  upcoming?: boolean
}

export type AdminNavGroup = {
  label: string
  items: readonly AdminNavLinkItem[]
}

/** Solo dos padres en el menú lateral; el resto va anidado bajo Torneo o Partidos. */
export const adminNavEntries: readonly AdminNavGroup[] = [
  {
    label: 'Torneo',
    items: [
      { label: 'Vista general', href: '/admin/overview', icon: LayoutDashboard },
      { label: 'Torneos', href: '/admin/tournaments', icon: Trophy },
      { label: 'Siguiente torneo', href: '/admin/next-tournament', icon: ArrowRightLeft },
      { label: 'Reglas', href: '/admin/rules', icon: Settings2 },
      { label: 'Grupos', href: '/admin/groups', icon: Flag },
      { label: 'Categorías', href: '/admin/categories', icon: Tags },
      { label: 'Usuarios', href: '/admin/users', icon: Users },
      { label: 'Notificaciones', href: '/admin/notifications', icon: Bell, upcoming: true },
      { label: 'Exportaciones', href: '/admin/exports', icon: Download, upcoming: true },
      { label: 'Configuración', href: '/admin/settings', icon: Settings },
    ],
  },
  {
    label: 'Partidos',
    items: [
      { label: 'Partidos', href: '/admin/matches', icon: CalendarClock },
      { label: 'Resultados', href: '/admin/results', icon: BarChart3 },
      { label: 'Importar resultados', href: '/admin/results/import', icon: Upload },
    ],
  },
]

/** Indica si la ruta cae bajo algún enlace del grupo (comparación por prefijo, rutas más largas primero). */
export function adminPathMatchesGroup(pathname: string, items: readonly { href: string }[]): boolean {
  const sorted = [...items].sort((a, b) => b.href.length - a.href.length)
  return sorted.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
}

function flattenAdminNavLinks(): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = []
  for (const group of adminNavEntries) {
    for (const item of group.items) {
      out.push({ label: item.label, href: item.href })
    }
  }
  return out
}

export function getAdminRouteTitle(pathname: string): string {
  const sorted = flattenAdminNavLinks().sort((a, b) => b.href.length - a.href.length)
  return sorted.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? 'Admin'
}

export const AdminBrandIcon = ShieldCheck
