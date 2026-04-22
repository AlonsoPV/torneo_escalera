import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { GlobalLeaderboardRow } from '@/services/home'
import { cn } from '@/lib/utils'

export function GlobalLeaderboardTable(props: {
  rows: GlobalLeaderboardRow[]
  highlightUserId?: string | null
}) {
  const { rows, highlightUserId } = props

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay puntos registrados. Cuando se confirmen partidos, aparecerán aquí.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-11">#</TableHead>
            <TableHead>Jugador</TableHead>
            <TableHead className="text-right">Torneos</TableHead>
            <TableHead className="text-right">PJ</TableHead>
            <TableHead className="text-right">PG</TableHead>
            <TableHead className="text-right">PP</TableHead>
            <TableHead className="text-right">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 25).map((r) => (
            <TableRow
              key={r.userId}
              className={cn(highlightUserId === r.userId && 'bg-primary/5')}
            >
              <TableCell className="font-medium tabular-nums">{r.position}</TableCell>
              <TableCell className="font-medium">{r.displayName}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {r.tournamentsCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.played}</TableCell>
              <TableCell className="text-right tabular-nums">{r.wins}</TableCell>
              <TableCell className="text-right tabular-nums">{r.losses}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{r.points}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
