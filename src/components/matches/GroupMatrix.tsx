import { Badge } from '@/components/ui/badge'
import { matchStatusLabels } from '@/lib/matchStatus'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { GroupPlayer, MatchRow } from '@/types/database'
import { matchMapByPair } from '@/services/matches'
import { formatScoreCompact } from '@/utils/score'
import { perspectiveSetsForCell } from '@/utils/ranking'

export function GroupMatrix(props: {
  players: GroupPlayer[]
  matches: MatchRow[]
  onOpenMatch: (match: MatchRow | null) => void
}) {
  const { players, matches, onOpenMatch } = props
  const map = matchMapByPair(matches)

  if (players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay jugadores en este grupo.
      </p>
    )
  }

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <ScrollArea className="w-full whitespace-nowrap">
        <table className="min-w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-card px-2 py-2 text-left font-medium text-muted-foreground">
                Jugador
              </th>
              {players.map((p, idx) => (
                <th
                  key={p.id}
                  className="min-w-[4.5rem] px-1 py-2 text-center font-medium text-muted-foreground"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                    {initials(p.display_name)}
                  </span>
                  <span className="sr-only">
                    {idx + 1}. {p.display_name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((row) => (
              <tr key={row.id} className="border-t">
                <th className="sticky left-0 z-20 bg-card px-2 py-2 text-left font-medium">
                  <span className="line-clamp-2 max-w-[7rem]">{row.display_name}</span>
                </th>
                {players.map((col) => {
                  const isDiag = row.id === col.id
                  const key = row.id < col.id ? `${row.id}:${col.id}` : `${col.id}:${row.id}`
                  const match = map.get(key) ?? null
                  const sets =
                    !isDiag && match
                      ? perspectiveSetsForCell(row.id, col.id, match)
                      : null
                  const isDefault = match
                    ? match.result_type === 'default_win_a' || match.result_type === 'default_win_b'
                    : false
                  const label =
                    isDefault && !sets?.length
                      ? 'W/O'
                      : sets && sets.length > 0
                        ? formatScoreCompact(sets)
                        : null

                  return (
                    <td key={col.id} className="p-0.5 align-middle">
                      {isDiag ? (
                        <div className="flex h-14 w-full items-center justify-center rounded-md bg-zinc-800/90 sm:h-16" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenMatch(match)}
                          className={cn(
                            'flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-md border px-1 text-[11px] font-medium transition-colors sm:h-16 sm:text-xs',
                            match?.status === 'closed' &&
                              'border-emerald-500/40 bg-emerald-500/10',
                            match?.status === 'player_confirmed' &&
                              'border-violet-500/35 bg-violet-500/10',
                            match?.status === 'pending_score' &&
                              'border-dashed border-primary/40 bg-background hover:bg-muted/60',
                            match?.status === 'score_submitted' &&
                              'border-sky-500/30 bg-sky-500/5',
                            match?.status === 'score_disputed' &&
                              'border-rose-500/35 bg-rose-500/10',
                            !match && 'border-dashed border-muted-foreground/30 bg-muted/20',
                          )}
                        >
                          {label ? (
                            <span className="leading-tight">{label}</span>
                          ) : (
                            <span className="text-muted-foreground">Capturar</span>
                          )}
                          {match ? (
                            <Badge
                              variant="outline"
                              className="h-5 px-1 text-[10px] font-normal"
                            >
                              {matchStatusLabels[match.status]}
                            </Badge>
                          ) : null}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
