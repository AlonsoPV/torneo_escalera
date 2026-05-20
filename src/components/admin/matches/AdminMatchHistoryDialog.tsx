import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { listMatchScoreEvents } from '@/services/matchScoreEvents'
import type { AdminMatchRecord } from '@/services/admin'

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

export function AdminMatchHistoryDialog({
  match,
  open,
  onOpenChange,
}: {
  match: AdminMatchRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const matchId = match?.id ?? ''
  const eventsQ = useQuery({
    queryKey: ['matchScoreEvents', matchId],
    queryFn: () => listMatchScoreEvents(matchId),
    enabled: open && Boolean(matchId),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,560px)] gap-0 overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Historial del marcador</DialogTitle>
          <DialogDescription>
            {match ? (
              <>
                {match.playerAName} vs {match.playerBName}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(55vh,380px)] overflow-y-auto border-y border-slate-100 px-1 py-3">
          {eventsQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : eventsQ.isError ? (
            <p className="text-sm text-red-600">
              {eventsQ.error instanceof Error ? eventsQ.error.message : 'No se pudo cargar el historial.'}
            </p>
          ) : !eventsQ.data?.length ? (
            <p className="text-sm text-slate-600">Sin eventos registrados para este partido.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {eventsQ.data.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 leading-snug text-slate-800"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <span className="font-medium text-slate-950">{ev.label}</span>
                    <span className="tabular-nums text-xs text-slate-500">{formatWhen(ev.created_at)}</span>
                  </div>
                  {ev.action_type ? (
                    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">{ev.action_type}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
