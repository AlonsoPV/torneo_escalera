import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { GroupProgressItem } from '@/utils/groupProgress'
import { cn } from '@/lib/utils'

function stateBadge(state: GroupProgressItem['state']) {
  switch (state) {
    case 'not_started':
      return <Badge variant="outline">Sin iniciar</Badge>
    case 'in_progress':
      return <Badge className="border-blue-200 bg-blue-50 text-blue-900">En progreso</Badge>
    case 'complete':
      return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-900">Completo</Badge>
    case 'pending_validation':
      return <Badge className="border-amber-200 bg-amber-50 text-amber-900">Pendiente validación</Badge>
    default:
      return null
  }
}

function GroupProgressItemRow({ g }: { g: GroupProgressItem }) {
  return (
    <li className="rounded-xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{g.groupName}</h3>
            {stateBadge(g.state)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {g.playerCount} jugadores · {g.matchesPlayed} / {g.matchesTotal} partidos jugados
          </p>
          {g.leaderName ? (
            <p className="mt-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">Líder: {g.leaderName}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Sin líder aún</p>
          )}
        </div>
        <div className="w-full sm:w-48">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Avance</span>
            <span className="tabular-nums font-medium text-foreground">{g.progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                g.state === 'complete' ? 'bg-emerald-500' : 'bg-emerald-500/70',
              )}
              style={{ width: `${g.progressPercent}%` }}
            />
          </div>
          {g.pendingValidationCount > 0 ? (
            <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">
              {g.pendingValidationCount} resultado(s) por validar
            </p>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function GroupProgressCard({ items }: { items: GroupProgressItem[] }) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="space-y-1 px-4 pb-3 pt-0 sm:px-6">
        <CardTitle className="text-base sm:text-lg">Progreso por grupo</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Partidos jugados, avance y líder en cada bloque.</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-4">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
            Aún no hay grupos creados.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((g) => (
              <GroupProgressItemRow key={g.groupId} g={g} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
