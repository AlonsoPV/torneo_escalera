import {
  BarChart3,
  Bell,
  CalendarClock,
  Download,
  Flag,
  LayoutDashboard,
  Settings,
  Settings2,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'

export const adminNavItems = [
  { label: 'Vista general', href: '/admin/overview', icon: LayoutDashboard },
  { label: 'Torneos', href: '/admin/tournaments', icon: Trophy },
  { label: 'Reglas', href: '/admin/rules', icon: Settings2 },
  { label: 'Grupos', href: '/admin/groups', icon: Flag },
  { label: 'Partidos', href: '/admin/matches', icon: CalendarClock },
  { label: 'Resultados', href: '/admin/results', icon: BarChart3 },
  { label: 'Usuarios', href: '/admin/users', icon: Users },
  { label: 'Notificaciones', href: '/admin/notifications', icon: Bell, upcoming: true },
  { label: 'Exportaciones', href: '/admin/exports', icon: Download, upcoming: true },
  { label: 'Configuración', href: '/admin/settings', icon: Settings },
] as const

export function getAdminRouteTitle(pathname: string): string {
  return adminNavItems.find((item) => pathname.startsWith(item.href))?.label ?? 'Admin'
}

export const AdminBrandIcon = ShieldCheck
