import { useQuery } from '@tanstack/react-query'

import { Skeleton } from '@/components/ui/skeleton'
import { matchStatusLabels } from '@/lib/matchStatus'
import { listGroupPlayers } from '@/services/groups'
import { listMatchesForGroup } from '@/services/matches'
import type { GroupPlayer, MatchRow } from '@/types/database'
import { pairKey } from '@/utils/matches'

function labelFor(
  m: MatchRow,
  byId: Map<string, { display_name: string }>,
): string {
  const a = byId.get(m.player_a_id)?.display_name ?? 'A'
  const b = byId.get(m.player_b_id)?.display_name ?? 'B'
  return `${a} — ${b}`
}

export function GroupMatchScheduleList(props: {
  groupId: string
  tournamentId: string
  currentUserId: string | null
}) {
  const { groupId } = props

  const pq = useQuery({
    queryKey: ['groupPlayers', groupId],
    queryFn: () => listGroupPlayers(groupId),
  })
  const mq = useQuery({
    queryKey: ['matches', groupId],
    queryFn: () => listMatchesForGroup(groupId),
  })

  const byId = new Map(
    (pq.data ?? []).map((p) => [p.id, p] as [string, GroupPlayer]),
  )

  if (mq.isLoading || pq.isLoading) {
    return <Skeleton className="h-32 w-full" />
  }
  if (!mq.data?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay partidos. Genera cruces primero.
      </p>
    )
  }

  const sorted = [...mq.data].sort((a, b) =>
    pairKey(a.player_a_id, a.player_b_id).localeCompare(
      pairKey(b.player_a_id, b.player_b_id),
    ),
  )

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        MVP sin agenda: los partidos se generan automáticamente cuando el grupo se completa y quedan disponibles
        para registrar marcador en cualquier momento.
      </p>
      <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {sorted.map((m) => (
            <li
              key={m.id}
              className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <p className="text-xs text-muted-foreground">Partido</p>
                <p className="text-sm font-medium leading-tight">{labelFor(m, byId)}</p>
                <p className="text-[10px] text-muted-foreground">Estado: {matchStatusLabels[m.status]}</p>
              </div>
              <p className="text-xs font-medium text-muted-foreground sm:text-right">
                {m.score_raw?.length ? 'Con marcador' : 'Pendiente'}
              </p>
            </li>
        ))}
      </ul>
    </div>
  )
}
