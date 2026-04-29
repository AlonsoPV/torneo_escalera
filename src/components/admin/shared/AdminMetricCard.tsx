import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function AdminMetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: number | string
  helper?: string
  icon?: LucideIcon
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'pending'
}) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    pending: 'bg-blue-100 text-blue-700',
  }

  return (
    <Card className="border-[#E2E8F0] bg-white shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:gap-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#64748B] sm:text-sm">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[#102A43] sm:mt-2 sm:text-3xl">{value}</p>
          {helper ? <p className="mt-1 text-xs text-[#64748B]">{helper}</p> : null}
        </div>
        {Icon ? (
          <span className={cn('shrink-0 rounded-2xl p-2.5 sm:p-3', tones[tone])}>
            <Icon className="size-4 sm:size-5" />
          </span>
        ) : null}
      </CardContent>
    </Card>
  )
}
