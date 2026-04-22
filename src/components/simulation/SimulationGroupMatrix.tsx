import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { PlayerRowLabel } from '@/components/simulation/PlayerRowLabel'
import { ScoreCell } from '@/components/simulation/ScoreCell'
import { getMatrixCellKind } from '@/components/simulation/matrixCellState'
import { getCellLabelAndTitle } from '@/components/simulation/matrixLabels'
import { cn } from '@/lib/utils'
import type { GroupStandingRow, SimMatch, SimPlayer } from '@/types/tournament'

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function buildMatchMap(matches: SimMatch[]): Map<string, SimMatch> {
  const m = new Map<string, SimMatch>()
  for (const x of matches) {
    m.set(pairKey(x.playerAId, x.playerBId), x)
  }
  return m
}

type Props = {
  players: SimPlayer[]
  matches: SimMatch[]
  standings: GroupStandingRow[]
}

export function SimulationGroupMatrix(props: Props) {
  const { players, matches, standings } = props
  const map = buildMatchMap(matches)
  const standingByPlayer = new Map(standings.map((s) => [s.playerId, s]))

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">No hay jugadores en este grupo</p>
      </div>
    )
  }

  const colPlayers = [...players].sort(
    (a, b) => a.seed_order - b.seed_order || a.id.localeCompare(b.id),
  )

  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl border border-border/50 bg-card/50 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none">
        <ScrollArea className="w-full">
          <table className="min-w-[720px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-30 min-w-[10rem] bg-card/95 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm sm:min-w-[11rem]"
                >
                  Jugador
                </th>
                {colPlayers.map((p, idx) => (
                  <th
                    key={p.id}
                    scope="col"
                    className="min-w-[5rem] px-1 pb-2 pt-3 text-center align-bottom"
                  >
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-muted/80 text-xs font-bold tabular-nums text-foreground shadow-sm">
                      {idx + 1}
                    </span>
                    <span className="sr-only">{p.full_name}</span>
                  </th>
                ))}
                <th
                  scope="col"
                  className="min-w-[2.5rem] px-1 text-center text-[10px] font-semibold uppercase text-muted-foreground"
                >
                  JG
                </th>
                <th
                  scope="col"
                  className="min-w-[2.5rem] px-1 text-center text-[10px] font-semibold uppercase text-muted-foreground"
                >
                  JP
                </th>
                <th
                  scope="col"
                  className="min-w-[2.75rem] px-1 text-center text-[10px] font-semibold uppercase text-teal-800 dark:text-teal-200"
                >
                  Pts
                </th>
                <th
                  scope="col"
                  className="min-w-[2.5rem] px-1 text-center text-[10px] font-semibold uppercase text-muted-foreground"
                >
                  #
                </th>
              </tr>
            </thead>
            <tbody>
              {colPlayers.map((row, ri) => {
                const st = standingByPlayer.get(row.id)
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-t border-border/40 transition-colors hover:bg-muted/20',
                      ri % 2 === 0 && 'bg-muted/[0.15]',
                    )}
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-20 border-t border-border/40 bg-card/95 px-2 py-2 text-left align-middle backdrop-blur-sm"
                    >
                      <PlayerRowLabel seed={row.seed_order} name={row.full_name} />
                    </th>
                    {colPlayers.map((col) => {
                      const isDiag = row.id === col.id
                      const match = !isDiag ? map.get(pairKey(row.id, col.id)) : undefined
                      const kind = getMatrixCellKind(row.id, col.id, match)
                      const { label, title } = getCellLabelAndTitle(row.id, match)
                      const matchType = match
                        ? match.resultType === 'default'
                          ? ('default' as const)
                          : ('normal' as const)
                        : null

                      return (
                        <td key={col.id} className="border-t border-border/40 p-1 align-middle">
                          {isDiag ? (
                            <ScoreCell kind="diagonal" label="" title="" />
                          ) : (
                            <ScoreCell
                              kind={kind}
                              label={label}
                              title={title}
                              matchType={matchType}
                            />
                          )}
                        </td>
                      )
                    })}
                    <td className="border-t border-border/40 px-1 text-center align-middle font-mono text-sm font-semibold tabular-nums text-foreground">
                      {st?.won ?? '—'}
                    </td>
                    <td className="border-t border-border/40 px-1 text-center align-middle font-mono text-sm tabular-nums text-muted-foreground">
                      {st?.lost ?? '—'}
                    </td>
                    <td className="border-t border-border/40 px-1 text-center align-middle font-mono text-sm font-bold tabular-nums text-teal-800 dark:text-teal-200">
                      {st?.points ?? '—'}
                    </td>
                    <td className="border-t border-border/40 px-1 text-center align-middle font-mono text-sm tabular-nums text-muted-foreground">
                      {st?.position ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-400/80" /> Victoria
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-slate-300 dark:bg-slate-600" /> Derrota
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-400/80" /> Por defecto
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/40" /> Diagonal
        </li>
      </ul>
    </div>
  )
}
