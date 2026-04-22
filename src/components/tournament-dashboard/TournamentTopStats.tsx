import { Grid3x3, Layers, Users, Volleyball } from 'lucide-react'

import { MetricCard } from '@/components/tournament-dashboard/MetricCard'
import { TDASH_COPY } from '@/lib/tournamentDashboardCopy'

type Props = {
  players: number
  groups: number
  matches: number
  formatLabel?: string
}

export function TournamentTopStats(props: Props) {
  const { players, groups, matches, formatLabel = TDASH_COPY.stats.formatValue } = props

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
      <MetricCard label={TDASH_COPY.stats.players} value={players} icon={<Users className="size-4" />} />
      <MetricCard label={TDASH_COPY.stats.groups} value={groups} icon={<Layers className="size-4" />} />
      <MetricCard
        label={TDASH_COPY.stats.matches}
        value={matches}
        icon={<Volleyball className="size-4" />}
      />
      <MetricCard
        label={TDASH_COPY.stats.format}
        value={formatLabel}
        icon={<Grid3x3 className="size-4" />}
      />
    </div>
  )
}
