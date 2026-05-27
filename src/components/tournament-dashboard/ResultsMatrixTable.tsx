import { ScoreCell } from '@/components/simulation/ScoreCell'
import { getMatrixCellKind } from '@/components/simulation/matrixCellState'
import { getCellLabelAndTitle } from '@/components/simulation/matrixLabels'
import { TDASH_COPY } from '@/lib/tournamentDashboardCopy'
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

export function ResultsMatrixTable(props: Props) {
  const { players, matches, standings } = props
  const map = buildMatchMap(matches)
  const standingByPlayer = new Map(standings.map((s) => [s.playerId, s]))

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--tdash-border)] bg-[var(--tdash-surface)] px-6 py-16 text-center">
        <p className="max-w-sm text-sm font-medium text-[var(--tdash-muted)]">{TDASH_COPY.emptyGroup}</p>
      </div>
    )
  }

  const colPlayers = [...players].sort(
    (a, b) => a.seed_order - b.seed_order || a.id.localeCompare(b.id),
  )

  return (
    <div className="relative rounded-lg border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-sm">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-40 w-4 bg-gradient-to-r from-[var(--tdash-surface)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-40 w-6 bg-gradient-to-l from-[var(--tdash-surface)] to-transparent" />
      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
        <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-xs sm:min-w-[760px] sm:text-sm lg:min-w-[860px]">
          <thead>
            <tr className="bg-[var(--tdash-surface-2)]">
              <th
                scope="col"
                className="sticky left-0 z-30 w-9 min-w-[2.25rem] border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-1.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--tdash-muted)] shadow-[2px_0_8px_rgba(15,23,42,0.06)] sm:w-11 sm:min-w-[2.75rem] sm:px-2 sm:py-3 sm:text-[11px]"
              >
                #
              </th>
              <th
                scope="col"
                className="sticky left-9 z-30 min-w-[6.25rem] border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[var(--tdash-muted)] shadow-[2px_0_8px_rgba(15,23,42,0.06)] sm:left-11 sm:min-w-[10rem] sm:px-3 sm:py-3 sm:text-[11px]"
              >
                Jugador
              </th>
              {colPlayers.map((p, idx) => (
                <th
                  key={p.id}
                  scope="col"
                  className="min-w-[3.75rem] border-b border-[var(--tdash-border)] px-0.5 py-2 text-center align-bottom sm:min-w-[5rem] sm:px-1 sm:py-3 lg:min-w-[5.5rem]"
                >
                  <span className="inline-flex size-7 items-center justify-center rounded-full border border-[var(--tdash-border)] bg-[var(--tdash-surface)] text-[11px] font-bold tabular-nums text-[var(--tdash-text)] shadow-sm sm:size-8 sm:text-xs lg:size-9">
                    {idx + 1}
                  </span>
                  <span className="sr-only">{p.full_name}</span>
                </th>
              ))}
              <th
                scope="col"
                className="min-w-[2.75rem] border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-0.5 py-2 text-center text-[9px] font-bold uppercase text-[var(--tdash-muted)] sm:px-1 sm:py-3 sm:text-[10px]"
              >
                PG
              </th>
              <th
                scope="col"
                className="min-w-[2.75rem] border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-0.5 py-2 text-center text-[9px] font-bold uppercase text-[var(--tdash-muted)] sm:px-1 sm:py-3 sm:text-[10px]"
              >
                PP
              </th>
              <th
                scope="col"
                className="min-w-[3rem] border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-0.5 py-2 text-center text-[9px] font-bold uppercase text-[var(--tdash-primary)] sm:px-1 sm:py-3 sm:text-[10px]"
              >
                PTS
              </th>
              <th
                scope="col"
                className="min-w-[2.75rem] border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-0.5 py-2 text-center text-[9px] font-bold uppercase text-[var(--tdash-muted)] sm:px-1 sm:py-3 sm:text-[10px]"
              >
                POS
              </th>
            </tr>
          </thead>
          <tbody>
            {colPlayers.map((row, ri) => {
              const st = standingByPlayer.get(row.id)
              const rowSurface = ri % 2 === 1 ? 'bg-[var(--tdash-surface-2)]' : 'bg-[var(--tdash-surface)]'

              return (
                <tr
                  key={row.id}
                  className={cn(
                    'transition-colors hover:bg-[var(--tdash-bg)]/80',
                    ri % 2 === 1 && 'bg-[var(--tdash-surface)]/80',
                  )}
                >
                  <th
                    scope="row"
                    className={cn(
                      'sticky left-0 z-20 w-9 min-w-[2.25rem] border-b border-[var(--tdash-border)] px-1.5 py-1.5 text-center align-middle font-mono text-[11px] font-bold tabular-nums text-[var(--tdash-muted)] shadow-[2px_0_8px_rgba(15,23,42,0.04)] sm:w-11 sm:min-w-[2.75rem] sm:px-2 sm:py-2 sm:text-xs',
                      rowSurface,
                    )}
                  >
                    {row.seed_order}
                  </th>
                  <th
                    scope="row"
                    className={cn(
                      'sticky left-9 z-20 max-w-[8rem] border-b border-[var(--tdash-border)] px-2 py-1.5 text-left align-middle shadow-[2px_0_8px_rgba(15,23,42,0.04)] sm:left-11 sm:max-w-[11rem] sm:px-3 sm:py-2',
                      rowSurface,
                    )}
                  >
                    <span className="line-clamp-2 text-left text-xs font-semibold leading-snug text-[var(--tdash-text)] sm:text-sm">
                      {row.full_name}
                    </span>
                  </th>
                  {colPlayers.map((col) => {
                    const isDiag = row.id === col.id
                    const match = !isDiag ? map.get(pairKey(row.id, col.id)) : undefined
                    const kind = getMatrixCellKind(row.id, col.id, match)
                    const { label, title } = getCellLabelAndTitle(row.id, match)
                    const matchType = match
                      ? match.status === 'score_disputed'
                        ? null
                        : match.resultType === 'default'
                        ? ('default' as const)
                        : ('normal' as const)
                      : null

                    return (
                      <td key={col.id} className="border-b border-[var(--tdash-border)] p-0.5 align-middle sm:p-1">
                        {isDiag ? (
                          <ScoreCell kind="diagonal" label="" />
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
                  <td className="border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-0.5 text-center align-middle font-mono text-xs font-semibold tabular-nums text-[var(--tdash-text)] sm:px-1 sm:text-sm">
                    {st?.won ?? '-'}
                  </td>
                  <td className="border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-0.5 text-center align-middle font-mono text-xs tabular-nums text-[var(--tdash-muted)] sm:px-1 sm:text-sm">
                    {st?.lost ?? '-'}
                  </td>
                  <td className="border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-0.5 text-center align-middle font-mono text-xs font-bold tabular-nums text-[var(--tdash-primary)] sm:px-1 sm:text-sm">
                    {st?.points ?? '-'}
                  </td>
                  <td className="border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-0.5 text-center align-middle font-mono text-xs tabular-nums text-[var(--tdash-muted)] sm:px-1 sm:text-sm">
                    {st?.position ?? '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
