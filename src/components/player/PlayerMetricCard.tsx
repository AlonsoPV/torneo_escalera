import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type Tone = 'gold' | 'primary' | 'blue' | 'green' | 'red' | 'amber'

const toneClasses: Record<Tone, { card: string; icon: string; value: string }> = {
  gold: {
    card: 'border-[#C8A96B]/35 bg-[#FFF9EA]',
    icon: 'bg-[#C8A96B]/20 text-[#7A5A16]',
    value: 'text-[#7A5A16]',
  },
  primary: {
    card: 'border-[#1F5A4C]/20 bg-[#F0F7F4]',
    icon: 'bg-[#1F5A4C]/12 text-[#1F5A4C]',
    value: 'text-[#1F5A4C]',
  },
  blue: {
    card: 'border-blue-200 bg-blue-50',
    icon: 'bg-blue-100 text-blue-700',
    value: 'text-blue-800',
  },
  green: {
    card: 'border-emerald-200 bg-emerald-50',
    icon: 'bg-emerald-100 text-emerald-700',
    value: 'text-emerald-700',
  },
  red: {
    card: 'border-red-200 bg-red-50',
    icon: 'bg-red-100 text-red-700',
    value: 'text-red-700',
  },
  amber: {
    card: 'border-amber-200 bg-amber-50',
    icon: 'bg-amber-100 text-amber-700',
    value: 'text-amber-700',
  },
}

export function PlayerMetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  icon: LucideIcon
  tone: Tone
}) {
  const t = toneClasses[tone]

  return (
    <div className={cn('rounded-2xl border p-3 shadow-sm sm:p-4', t.card)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl', t.icon)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl', t.value)}>
        {value}
      </p>
    </div>
  )
}
