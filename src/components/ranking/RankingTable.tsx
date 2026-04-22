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
      <p className="text-sm text-muted-foreground">Sin datos de ranking aún.</p>
    )
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
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
            <TableRow key={r.groupPlayerId}>
              <TableCell className="font-medium">{r.position}</TableCell>
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
