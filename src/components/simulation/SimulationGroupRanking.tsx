import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { GroupStandingRow } from '@/types/tournament'

type Props = {
  rows: GroupStandingRow[]
}

const medal: Record<number, string> = {
  1: 'border-l-amber-400 bg-amber-50/50 dark:border-l-amber-400/80 dark:bg-amber-950/25',
  2: 'border-l-slate-300 bg-slate-50/60 dark:border-l-slate-500 dark:bg-slate-900/35',
  3: 'border-l-orange-300 bg-orange-50/45 dark:border-l-orange-400/70 dark:bg-orange-950/30',
}

function posBadge(p: number) {
  return cn(
    'inline-flex size-8 items-center justify-center rounded-full text-sm font-bold tabular-nums',
    p === 1 && 'bg-amber-100 text-amber-900 shadow-sm dark:bg-amber-900/55 dark:text-amber-50',
    p === 2 && 'bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-50',
    p === 3 && 'bg-orange-100 text-orange-900 dark:bg-orange-900/45 dark:text-orange-50',
    p > 3 && 'bg-muted text-muted-foreground',
  )
}

export function SimulationGroupRanking(props: Props) {
  const { rows } = props
  const [openId, setOpenId] = useState<string | null>(null)

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/15 py-14 text-center">
        <p className="text-sm font-medium text-muted-foreground">Sin datos de clasificación</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 md:hidden">
        {rows.map((r) => {
          const open = openId === r.playerId
          return (
            <div
              key={r.playerId}
              className={cn(
                'overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm',
                medal[r.position],
                'border-l-[5px]',
              )}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : r.playerId)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={posBadge(r.position)}>{r.position}</span>
                  <span className="truncate font-semibold">{r.displayName}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-lg font-bold tabular-nums text-teal-800 dark:text-teal-200">
                    {r.points}
                  </span>
                  <span className="text-xs text-muted-foreground">pts</span>
                  <ChevronDown
                    className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')}
                  />
                </div>
              </button>
              {open ? (
                <div className="border-t border-border/50 bg-muted/25 px-4 py-3">
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">PJ</dt>
                      <dd className="font-mono font-semibold">{r.played}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">PG / PP</dt>
                      <dd className="font-mono font-semibold">
                        {r.won} / {r.lost}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Def + / −</dt>
                      <dd className="font-mono font-semibold">
                        {r.defaultsWon} / {r.defaultsLost}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Sets (F/C)</dt>
                      <dd className="font-mono font-semibold">
                        {r.setsFor} / {r.setsAgainst}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Games (JF / JC)</dt>
                      <dd className="font-mono font-semibold">
                        {r.gamesFor} / {r.gamesAgainst}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-2xl border border-border/50 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="w-12">#</TableHead>
                <TableHead>Jugador</TableHead>
                <TableHead className="text-right">PJ</TableHead>
                <TableHead className="text-right">PG</TableHead>
                <TableHead className="text-right">PP</TableHead>
                <TableHead className="text-right text-muted-foreground">D+</TableHead>
                <TableHead className="text-right text-muted-foreground">D−</TableHead>
                <TableHead className="text-right">SF</TableHead>
                <TableHead className="text-right">SC</TableHead>
                <TableHead className="text-right">JF</TableHead>
                <TableHead className="text-right">JC</TableHead>
                <TableHead className="text-right text-teal-800 dark:text-teal-200">Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.playerId}
                  className={cn(
                    'border-border/50 border-l-4 transition-colors hover:bg-muted/25',
                    medal[r.position] ?? 'border-l-transparent',
                  )}
                >
                  <TableCell className="font-medium">
                    <span className={posBadge(r.position)}>{r.position}</span>
                  </TableCell>
                  <TableCell className="font-semibold">{r.displayName}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r.played}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r.won}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r.lost}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {r.defaultsWon}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {r.defaultsLost}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r.setsFor}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r.setsAgainst}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r.gamesFor}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r.gamesAgainst}</TableCell>
                  <TableCell className="text-right font-mono text-base font-bold tabular-nums text-teal-800 dark:text-teal-200">
                    {r.points}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
