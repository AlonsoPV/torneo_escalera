import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

export function AdminEmptyState({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string
  description: string
  icon?: LucideIcon
  action?: ReactNode
}) {
  return (
    <Card className="border-dashed border-[#E2E8F0] bg-white/80">
      <CardContent className="flex flex-col items-center px-6 py-12 text-center">
        {Icon ? (
          <span className="mb-4 rounded-3xl bg-[#F6F3EE] p-4 text-[#1F5A4C]">
            <Icon className="size-6" />
          </span>
        ) : null}
        <h3 className="text-base font-semibold text-[#102A43]">{title}</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  )
}
