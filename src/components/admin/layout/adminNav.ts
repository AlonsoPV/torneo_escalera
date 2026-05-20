import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Download,
  Flag,
  LayoutDashboard,
  List,
  Settings,
  Settings2,
  ShieldCheck,
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

function splitHref(href: string): { path: string; search: string } {
  const q = href.indexOf('?')
  if (q === -1) return { path: href, search: '' }
  return { path: href.slice(0, q), search: href.slice(q) }
}

/** Activa el estilo del enlace lateral según `pathname` + `search`. */
export function adminNavLinkActive(
  location: { pathname: string; search: string },
  href: string,
): boolean {
  const { path, search: hrefSearch } = splitHref(href)
  if (path === '/admin/matches/import') {
    return location.pathname.startsWith('/admin/matches/import')
  }
  const full = `${location.pathname}${location.search}`
  if (hrefSearch) {
    return full === `${path}${hrefSearch}`
  }
  if (path === '/admin/matches') {
    const tab = new URLSearchParams(location.search).get('tab')
    return location.pathname === '/admin/matches' && (!tab || tab === 'all')
  }
  return location.pathname === path || location.pathname.startsWith(`${path}/`)
}

/** Solo dos padres en el menú lateral; el resto va anidado bajo Torneo o Partidos. */
export const adminNavEntries: readonly AdminNavGroup[] = [
  {
    label: 'Torneo',
    items: [
      { label: 'Vista general', href: '/admin/overview', icon: LayoutDashboard },
      { label: 'Torneos', href: '/admin/tournaments', icon: Trophy },
      { label: 'Reglas', href: '/admin/rules', icon: Settings2 },
      { label: 'Grupos', href: '/admin/groups', icon: Flag },
      { label: 'Usuarios', href: '/admin/users', icon: Users },
      { label: 'Notificaciones', href: '/admin/notifications', icon: Bell },
      { label: 'Exportaciones', href: '/admin/exports', icon: Download, upcoming: true },
      { label: 'Configuración', href: '/admin/settings', icon: Settings },
    ],
  },
  {
    label: 'Partidos',
    items: [
      { label: 'Todos', href: '/admin/matches', icon: List },
      { label: 'Importar resultados', href: '/admin/matches/import', icon: Upload },
    ],
  },
]

/** Indica si la ruta cae bajo algún enlace del grupo (incluye query en enlaces de Partidos). */
export function adminPathMatchesGroup(
  pathname: string,
  search: string,
  items: readonly { href: string }[],
): boolean {
  const loc = { pathname, search }
  return items.some((item) => adminNavLinkActive(loc, item.href))
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

export function getAdminRouteTitle(pathname: string, search: string): string {
  if (pathname === '/admin/next-tournament' || pathname.startsWith('/admin/next-tournament/')) {
    return 'Siguiente torneo'
  }
  if (pathname.startsWith('/admin/matches/import')) {
    return 'Importar resultados'
  }
  const loc = { pathname, search }
  const sorted = flattenAdminNavLinks().sort((a, b) => b.href.length - a.href.length)
  const hit = sorted.find((item) => adminNavLinkActive(loc, item.href))
  return hit?.label ?? 'Admin'
}

export const AdminBrandIcon = ShieldCheck
