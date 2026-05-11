import { Activity, Gauge, ListOrdered, Timer, Trophy } from 'lucide-react'

import { PlayerMetricCard } from '@/components/player/PlayerMetricCard'
import { cn } from '@/lib/utils'
import type { PlayerSummary } from '@/services/playerViewModel'

type Props = {
  summary: PlayerSummary
  className?: string
}

function signed(value: number) {
  if (value > 0) return `+${value}`
  return String(value)
}

export function PlayerSummaryCards({ summary, className }: Props) {
  const items = [
    {
      label: 'Posición',
      value: summary.position > 0 ? `#${summary.position}` : '—',
      icon: ListOrdered,
      tone: 'gold' as const,
    },
    {
      label: 'Puntos',
      value: String(summary.points),
      icon: Trophy,
      tone: 'primary' as const,
    },
    {
      label: 'Jugados',
      value: summary.playedLabel,
      icon: Activity,
      tone: 'blue' as const,
    },
    {
      label: 'Dif. juegos',
      value: signed(summary.gamesDifference),
      icon: Gauge,
      tone: summary.gamesDifference < 0 ? ('red' as const) : ('green' as const),
    },
    {
      label: 'Pendientes',
      value: String(summary.pendingCount),
      icon: Timer,
      tone: 'amber' as const,
    },
  ]

  return (
    <section
      id="player-section-summary"
      data-name="player-section-summary"
      className={cn('grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5', className)}
    >
      {items.map((it) => (
        <PlayerMetricCard key={it.label} label={it.label} value={it.value} icon={it.icon} tone={it.tone} />
      ))}
    </section>
  )
}
