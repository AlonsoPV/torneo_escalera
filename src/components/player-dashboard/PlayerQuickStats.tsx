import { Award, Hash, ListChecks, TrendingUp } from 'lucide-react'

import { MetricCard } from '@/components/tournament-dashboard/MetricCard'
import { cn } from '@/lib/utils'
import type { RankingRow } from '@/utils/ranking'

type Props = {
  standing: RankingRow | null
  className?: string
}

export function PlayerQuickStats(props: Props) {
  const { standing, className } = props
  if (!standing) {
    return (
        <div
        className={cn(
          'grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4',
          className,
        )}
      >
        <MetricCard label="Posición" value="—" icon={<Hash className="size-4" />} />
        <MetricCard label="Puntos" value="—" icon={<Award className="size-4" />} />
        <MetricCard label="Jugados" value="—" icon={<ListChecks className="size-4" />} />
        <MetricCard label="Ganados" value="—" icon={<TrendingUp className="size-4" />} />
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4', className)}>
      <MetricCard
        label="Posición"
        value={standing.position}
        icon={<Hash className="size-4" />}
      />
      <MetricCard
        label="Puntos"
        value={standing.points}
        icon={<Award className="size-4" />}
      />
      <MetricCard
        label="Jugados"
        value={standing.played}
        icon={<ListChecks className="size-4" />}
      />
      <MetricCard
        label="Ganados"
        value={standing.won}
        icon={<TrendingUp className="size-4" />}
      />
    </div>
  )
}
