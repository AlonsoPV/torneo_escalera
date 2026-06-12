import { Menu } from 'lucide-react'
import { useState } from 'react'

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

/** Barra móvil: solo menú lateral. Títulos en AdminPageHeader de cada pantalla. */
export function AdminTopbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 border-b border-[#E2E8F0] bg-[#F6F3EE]/90 px-3 py-2 backdrop-blur md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" size="icon" className="shrink-0" />}>
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
    </header>
  )
}
