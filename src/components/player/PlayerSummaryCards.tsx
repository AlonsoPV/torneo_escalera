import { Activity, ListOrdered, Timer, Trophy } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { PlayerSummary } from '@/services/playerViewModel'

const card =
  'rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5'

type Props = {
  summary: PlayerSummary
  className?: string
}

export function PlayerSummaryCards({ summary, className }: Props) {
  const items = [
    {
      label: 'Posición',
      value: summary.position > 0 ? `#${summary.position}` : '—',
      icon: ListOrdered,
    },
    {
      label: 'Puntos',
      value: String(summary.points),
      icon: Trophy,
    },
    {
      label: 'Jugados',
      value: summary.playedLabel,
      icon: Activity,
    },
    {
      label: 'Pendientes',
      value: String(summary.pendingCount),
      icon: Timer,
    },
  ]

  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4', className)}>
      {items.map((it) => (
        <div key={it.label} className={card}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-[#64748B]">{it.label}</p>
            <span className="flex size-8 items-center justify-center rounded-xl bg-[#F6F3EE] text-[#1F5A4C]">
              <it.icon className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[#102A43] sm:text-3xl">{it.value}</p>
        </div>
      ))}
    </div>
  )
}
