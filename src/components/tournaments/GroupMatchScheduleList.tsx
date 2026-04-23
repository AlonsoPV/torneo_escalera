import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { listGroupPlayers } from '@/services/groups'
import { listMatchesForGroup, updateMatchSchedule } from '@/services/matches'
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
  const { groupId, currentUserId } = props
  const qc = useQueryClient()
  const [rowPatch, setRowPatch] = useState<
    Record<string, { end?: string; loc?: string }>
  >({})

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

  useEffect(() => {
    if (!mq.data) return
    setRowPatch((prev) => {
      const next = { ...prev }
      for (const m of mq.data) {
        if (next[m.id] !== undefined) continue
        const end = m.scheduled_end_at
          ? new Date(m.scheduled_end_at).toISOString().slice(0, 16)
          : ''
        const loc = m.location ?? ''
        next[m.id] = { end, loc }
      }
      return next
    })
  }, [mq.data])

  const saveMut = useMutation({
    mutationFn: async (m: MatchRow) => {
      if (!currentUserId) throw new Error('No autenticado')
      const p = rowPatch[m.id] ?? { end: '', loc: '' }
      const endIso = p.end
        ? new Date(p.end).toISOString()
        : null
      await updateMatchSchedule(
        m.id,
        { scheduled_end_at: endIso, location: p.loc || null },
        currentUserId,
      )
    },
    onSuccess: async () => {
      toast.success('Agenda actualizada')
      await qc.invalidateQueries({ queryKey: ['matches', groupId] })
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    },
  })

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
        Indica al menos <span className="font-medium">Hora de fin</span> para la ventana de captura de
        resultados. El jugador podrá marcar el marcador solo después de esa hora.
      </p>
      <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {sorted.map((m) => {
          const st = rowPatch[m.id] ?? { end: '', loc: m.location ?? '' }
          return (
            <li
              key={m.id}
              className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_auto_auto] sm:items-end"
            >
              <div>
                <p className="text-xs text-muted-foreground">Partido</p>
                <p className="text-sm font-medium leading-tight">{labelFor(m, byId)}</p>
                <p className="text-[10px] text-muted-foreground">Estado: {m.status}</p>
              </div>
              <div>
                <Label className="text-xs">Fin (local)</Label>
                <Input
                  type="datetime-local"
                  value={st.end}
                  onChange={(e) =>
                    setRowPatch((prev) => ({
                      ...prev,
                      [m.id]: { ...st, end: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Cancha / nota (opcional)</Label>
                <Input
                  value={st.loc}
                  onChange={(e) =>
                    setRowPatch((prev) => ({
                      ...prev,
                      [m.id]: { ...st, loc: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="sm:col-span-3">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={saveMut.isPending}
                  onClick={() => saveMut.mutate(m)}
                >
                  Guardar
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
