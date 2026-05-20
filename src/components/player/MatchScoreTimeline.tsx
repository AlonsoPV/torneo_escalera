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

export function MatchScoreTimeline({ matchId, className }: { matchId: string; className?: string }) {
  const q = useQuery({
    queryKey: ['matchScoreLogs', matchId],
    queryFn: () => listMatchScoreLogs(matchId),
    staleTime: 60_000,
  })

  if (q.isLoading) {
    return <p className={cn('text-xs text-muted-foreground', className)}>Cargando historial…</p>
  }
  if (q.isError) {
    return null
  }
  const rows = q.data ?? []
  if (!rows.length) return null

  return (
    <div className={cn('mt-3 border-t border-[#E2E8F0]/80 pt-3', className)}>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">Historial</p>
      <ul className="space-y-1.5 text-xs text-[#475569]">
        {rows.map((row) => (
          <li key={row.id} className="flex gap-2 border-l-2 border-[#1F5A4C]/25 pl-2">
            <span className="shrink-0 text-[10px] text-[#94a3b8]">
              {new Date(row.created_at).toLocaleString(undefined, {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span>{describeAction(row.action_type)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
