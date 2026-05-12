import { CalendarDays, CheckCircle2, LayoutGrid, Users } from 'lucide-react'

import type { TournamentScopeMetrics } from '@/utils/tournamentMetrics'

import { TournamentMetricCard } from '@/components/dashboard/TournamentMetricCard'

export function TournamentPerformanceOverview({ metrics }: { metrics: TournamentScopeMetrics }) {
  return (
    <section aria-labelledby="tdash-perf-heading" className="space-y-3">
      <h2 id="tdash-perf-heading" className="text-sm font-semibold text-foreground">
        Desempeño general
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TournamentMetricCard
          label="Jugadores"
          value={metrics.totalPlayers}
          hint="Registrados"
          icon={Users}
          tone="neutral"
        />
        <TournamentMetricCard
          label="Grupos"
          value={metrics.totalGroups}
          hint="Activos"
          icon={LayoutGrid}
          tone="neutral"
        />
        <TournamentMetricCard
          label="Cruces"
          value={metrics.matchesTotal}
          hint="No cancelados"
          icon={CalendarDays}
          tone="blue"
        />
        <TournamentMetricCard
          label="Jugados"
          value={
            <>
              {metrics.matchesPlayed}{' '}
              <span className="text-base font-semibold text-muted-foreground">/ {metrics.matchesTotal}</span>
            </>
          }
          hint="Cerrados"
          icon={CheckCircle2}
          tone="emerald"
          progressPercent={metrics.progressPercent}
        />
      </div>
    </section>
  )
}
