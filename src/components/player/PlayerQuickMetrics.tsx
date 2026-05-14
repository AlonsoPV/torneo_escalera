import { Activity, Gauge, ListOrdered, Timer, Trophy } from 'lucide-react'

import { PlayerMetricCard } from '@/components/player/PlayerMetricCard'
import { cn } from '@/lib/utils'
import type { PlayerSummary } from '@/services/playerViewModel'

function signed(value: number) {
  if (value > 0) return `+${value}`
  return String(value)
}

export function PlayerQuickMetrics({ summary, className }: { summary: PlayerSummary; className?: string }) {
  const items = [
    {
      label: 'Posición',
      labelShort: 'Pos.',
      value: summary.position > 0 ? `#${summary.position}` : '—',
      icon: ListOrdered,
      tone: 'gold' as const,
    },
    { label: 'Puntos', value: String(summary.points), icon: Trophy, tone: 'primary' as const },
    { label: 'Jugados', value: summary.playedLabel, icon: Activity, tone: 'blue' as const },
    {
      label: 'Dif. juegos',
      labelShort: 'Dif.',
      value: signed(summary.gamesDifference),
      icon: Gauge,
      tone: summary.gamesDifference < 0 ? ('red' as const) : ('green' as const),
    },
    {
      label: 'Pendientes',
      labelShort: 'Pend.',
      value: String(summary.pendingCount),
      icon: Timer,
      tone: 'amber' as const,
    },
  ]

  return (
    <section
      id="player-section-metrics"
      data-name="player-section-metrics"
      className={cn(
        'grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-2.5',
        className,
      )}
    >
      {items.map((it, index) => (
        <div
          key={it.label}
          className={cn(
            'min-w-0',
            index === items.length - 1 && 'col-span-2 sm:col-span-1 lg:col-span-1',
          )}
        >
          <PlayerMetricCard
            compact
            className="w-full"
            label={it.label}
            labelShort={it.labelShort}
            value={it.value}
            icon={it.icon}
            tone={it.tone}
          />
        </div>
      ))}
    </section>
  )
}
