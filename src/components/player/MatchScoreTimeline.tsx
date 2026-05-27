import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { listMatchScoreLogs } from '@/services/matches'
import { cn } from '@/lib/utils'

function describeAction(actionType: string): string {
  switch (actionType) {
    case 'player_a_submit':
      return 'Jugador A registró marcador'
    case 'player_b_submit':
      return 'Jugador B registró marcador'
    case 'player_resubmit_after_dispute':
      return 'Reenvío tras disputa (histórico)'
    case 'opponent_reject':
      return 'Rival refutó resultado'
    case 'player_disputed':
      return 'Marcador refutado por rival'
    case 'match_validated':
      return 'Resultado validado por administración'
    case 'admin_score_corrected':
      return 'Marcador corregido por administración'
    case 'admin_invalidate_match':
      return 'Partido invalidado por administración'
    case 'admin_update':
      return 'Actualización administrativa'
    default:
      return actionType.replace(/_/g, ' ')
  }
}

export function MatchScoreTimeline({
  matchId,
  className,
  collapsible = false,
  defaultCollapsed = false,
}: {
  matchId: string
  className?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
}) {
  const [open, setOpen] = useState(!defaultCollapsed)
  const q = useQuery({
    queryKey: ['matchScoreLogs', matchId],
    queryFn: () => listMatchScoreLogs(matchId),
    staleTime: 60_000,
  })

  if (q.isLoading) {
    return <p className={cn('text-xs text-slate-400', className)}>Cargando historial…</p>
  }
  if (q.isError) return null
  const rows = q.data ?? []
  if (!rows.length) return null

  const list = (
    <ul className="space-y-1.5 text-xs text-slate-600">
      {rows.map((row) => (
        <li key={row.id} className="flex gap-2 border-l-2 border-[#1F5A4C]/20 pl-2">
          <time className="shrink-0 text-[10px] tabular-nums text-slate-400">
            {new Date(row.created_at).toLocaleString(undefined, {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
          <span>{describeAction(row.action_type)}</span>
        </li>
      ))}
    </ul>
  )

  if (!collapsible) {
    return (
      <div className={cn('border-t border-slate-200/80 pt-3', className)}>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Historial</p>
        {list}
      </div>
    )
  }

  return (
    <div className={cn('border-t border-slate-200/80 pt-2', className)}>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded-md py-1 text-left text-xs font-medium text-slate-600 hover:text-[#102A43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/25"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
        Historial ({rows.length})
      </button>
      {open ? <div className="mt-2">{list}</div> : null}
    </div>
  )
}
