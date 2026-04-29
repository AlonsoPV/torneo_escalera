import { Menu } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import { AdminSidebar } from '@/components/admin/layout/AdminSidebar'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/stores/authStore'

import { getAdminRouteTitle } from './adminNav'

function profileInitials(fullName: string | null | undefined, email: string | null | undefined) {
  const name = fullName?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      const a = parts[0]?.[0]
      const b = parts[parts.length - 1]?.[0]
      if (a && b) return (a + b).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  const e = email?.trim()
  if (e && e.length >= 2) return e.slice(0, 2).toUpperCase()
  return '?'
}

export function AdminTopbar() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const profile = useAuthStore((s) => s.profile)
  const title = getAdminRouteTitle(location.pathname)
  const initials = profileInitials(profile?.full_name, profile?.email)

  return (
    <header className="sticky top-0 z-20 border-b border-[#E2E8F0] bg-[#F6F3EE]/90 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-4 md:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="outline" size="icon" className="shrink-0 md:hidden" />}>
              <Menu className="size-4" />
              <span className="sr-only">Abrir navegación admin</span>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[min(100vw-1rem,20rem)] flex-col p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navegación de administración</SheetTitle>
                <SheetDescription>Menú principal del dashboard administrador.</SheetDescription>
              </SheetHeader>
              <AdminSidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#64748B] sm:text-xs">Admin</p>
            <h1 className="truncate text-base font-semibold text-[#102A43] sm:text-lg">{title}</h1>
          </div>
        </div>

        <div className="hidden shrink-0 rounded-full border border-[#E2E8F0] bg-white px-3 py-2 text-right shadow-sm sm:block md:max-w-[14rem]">
          <p className="truncate text-xs font-medium text-[#102A43]">
            {profile?.full_name ?? profile?.email ?? 'Administrador'}
          </p>
          <p className="truncate text-[11px] capitalize text-[#64748B]">{profile?.role ?? 'admin'}</p>
        </div>

        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[11px] font-semibold text-[#1F5A4C] shadow-sm sm:hidden"
          title={profile?.full_name ?? profile?.email ?? 'Administrador'}
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
