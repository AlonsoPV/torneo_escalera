import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Contenedor consistente para filtros / herramientas en páginas admin (ancho fluido en móvil). */
export function AdminFilterCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('w-full max-w-full border-[#E2E8F0] bg-white shadow-sm sm:max-w-md', className)}>
      <CardContent className="p-5 sm:p-6">{children}</CardContent>
    </Card>
  )
}
