import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { RankingRow } from '@/utils/ranking'

export function RankingTable(props: { rows: RankingRow[] }) {
  const { rows } = props

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Sin datos de ranking aún</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Aparecerá cuando haya partidos con resultado en este grupo.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10">#</TableHead>
            <TableHead>Jugador</TableHead>
            <TableHead className="text-right">PJ</TableHead>
            <TableHead className="text-right">PG</TableHead>
            <TableHead className="text-right">PP</TableHead>
            <TableHead className="text-right">SF</TableHead>
            <TableHead className="text-right">SC</TableHead>
            <TableHead className="text-right">JF</TableHead>
            <TableHead className="text-right">JC</TableHead>
            <TableHead className="text-right">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.groupPlayerId}
              className={
                r.position === 1
                  ? 'bg-amber-500/5'
                  : r.position === 2
                    ? 'bg-zinc-500/5'
                    : r.position === 3
                      ? 'bg-orange-700/5'
                      : undefined
              }
            >
              <TableCell className="font-semibold tabular-nums text-muted-foreground">
                {r.position}
              </TableCell>
              <TableCell className="font-medium">{r.displayName}</TableCell>
              <TableCell className="text-right tabular-nums">{r.played}</TableCell>
              <TableCell className="text-right tabular-nums">{r.won}</TableCell>
              <TableCell className="text-right tabular-nums">{r.lost}</TableCell>
              <TableCell className="text-right tabular-nums">{r.setsFor}</TableCell>
              <TableCell className="text-right tabular-nums">{r.setsAgainst}</TableCell>
              <TableCell className="text-right tabular-nums">{r.gamesFor}</TableCell>
              <TableCell className="text-right tabular-nums">{r.gamesAgainst}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">
                {r.points}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
