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
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-6 py-16 text-center">
        <p className="max-w-sm text-sm font-medium text-[var(--tdash-muted)]">{TDASH_COPY.emptyGroup}</p>
      </div>
    )
  }

  const colPlayers = [...players].sort(
    (a, b) => a.seed_order - b.seed_order || a.id.localeCompare(b.id),
  )

  return (
    <div className="relative overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
      <table className="min-w-[760px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]">
              <th
                scope="col"
                className="sticky left-0 z-30 w-11 min-w-[2.75rem] bg-[var(--tdash-surface-2)] px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-[var(--tdash-muted)] shadow-[2px_0_8px_rgba(15,23,42,0.06)]"
              >
                #
              </th>
              <th
                scope="col"
                className="sticky left-11 z-30 min-w-[9.5rem] bg-[var(--tdash-surface-2)] px-2 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--tdash-muted)] shadow-[2px_0_8px_rgba(15,23,42,0.06)]"
              >
                Jugador
              </th>
              {colPlayers.map((p, idx) => (
                <th
                  key={p.id}
                  scope="col"
                  className="min-w-[5rem] px-1 py-3 text-center align-bottom"
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--tdash-border)] bg-[var(--tdash-surface)] text-xs font-bold tabular-nums text-[var(--tdash-text)] shadow-sm">
                    {idx + 1}
                  </span>
                  <span className="sr-only">{p.full_name}</span>
                </th>
              ))}
              <th
                scope="col"
                className="min-w-[2.75rem] bg-[var(--tdash-surface-2)] px-1 py-3 text-center text-[10px] font-bold uppercase text-[var(--tdash-muted)]"
              >
                PG
              </th>
              <th
                scope="col"
                className="min-w-[2.75rem] bg-[var(--tdash-surface-2)] px-1 py-3 text-center text-[10px] font-bold uppercase text-[var(--tdash-muted)]"
              >
                PP
              </th>
              <th
                scope="col"
                className="min-w-[3rem] bg-[var(--tdash-surface-2)] px-1 py-3 text-center text-[10px] font-bold uppercase text-[var(--tdash-primary)]"
              >
                PTS
              </th>
              <th
                scope="col"
                className="min-w-[2.75rem] bg-[var(--tdash-surface-2)] px-1 py-3 text-center text-[10px] font-bold uppercase text-[var(--tdash-muted)]"
              >
                POS
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
                    'border-b border-[var(--tdash-border)] transition-colors hover:bg-[var(--tdash-bg)]/80',
                    ri % 2 === 1 && 'bg-[var(--tdash-surface)]/80',
                  )}
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-20 bg-[var(--tdash-surface)] px-2 py-2 text-center align-middle font-mono text-xs font-bold tabular-nums text-[var(--tdash-muted)] shadow-[2px_0_8px_rgba(15,23,42,0.04)]"
                  >
                    {row.seed_order}
                  </th>
                  <th
                    scope="row"
                    className="sticky left-11 z-20 max-w-[11rem] bg-[var(--tdash-surface)] px-2 py-2 text-left align-middle shadow-[2px_0_8px_rgba(15,23,42,0.04)]"
                  >
                    <span className="line-clamp-2 text-left text-sm font-semibold leading-snug text-[var(--tdash-text)]">
                      {row.full_name}
                    </span>
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
                      <td key={col.id} className="p-1 align-middle">
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
                  <td className="bg-[var(--tdash-surface-2)] px-1 text-center align-middle font-mono text-sm font-semibold tabular-nums text-[var(--tdash-text)]">
                    {st?.won ?? '—'}
                  </td>
                  <td className="bg-[var(--tdash-surface-2)] px-1 text-center align-middle font-mono text-sm tabular-nums text-[var(--tdash-muted)]">
                    {st?.lost ?? '—'}
                  </td>
                  <td className="bg-[var(--tdash-surface-2)] px-1 text-center align-middle font-mono text-sm font-bold tabular-nums text-[var(--tdash-primary)]">
                    {st?.points ?? '—'}
                  </td>
                  <td className="bg-[var(--tdash-surface-2)] px-1 text-center align-middle font-mono text-sm tabular-nums text-[var(--tdash-muted)]">
                    {st?.position ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
      </table>
    </div>
  )
}
