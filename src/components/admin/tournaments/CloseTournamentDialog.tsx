import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { cloneElement, useState, type MouseEvent, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { finishTournament, getTournamentClosureBlockers } from '@/services/tournamentClosure'

type TriggerElement = ReactElement<{
  onClick?: (event: MouseEvent<HTMLElement>) => void
}>

export function CloseTournamentDialog({
  tournamentId,
  tournamentName,
  closedBy,
  trigger,
  disabled,
}: {
  tournamentId: string
  tournamentName: string
  closedBy: string | undefined
  trigger: TriggerElement
  disabled?: boolean
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [applyDefaultRules, setApplyDefaultRules] = useState(false)

  const blockersQ = useQuery({
    queryKey: ['tournamentClosureBlockers', tournamentId],
    queryFn: () => getTournamentClosureBlockers(tournamentId),
    enabled: open && Boolean(tournamentId),
  })

  const closeMut = useMutation({
    mutationFn: async () => {
      if (!closedBy) throw new Error('No autenticado.')
      await finishTournament({
        tournamentId,
        closedBy,
        applyMissingScoresAsDoublePenalty: applyDefaultRules,
      })
    },
    onSuccess: async () => {
      toast.success('Torneo cerrado: clasificación final guardada.')
      setOpen(false)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-tournaments'] }),
        qc.invalidateQueries({ queryKey: ['tournaments'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
        qc.invalidateQueries({ queryKey: ['tournamentClosureBlockers', tournamentId] }),
        qc.invalidateQueries({ queryKey: ['nextTournamentPreview', tournamentId] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo cerrar el torneo'),
  })

  const blockers = blockersQ.data
  const canClose = blockers?.canClose ?? false
  const canCloseWithDefaultRules = blockers?.canCloseWithDefaultRules ?? false
  const canConfirmClose = canClose || (applyDefaultRules && canCloseWithDefaultRules)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {cloneElement(trigger, {
        onClick: (event: MouseEvent<HTMLElement>) => {
          trigger.props.onClick?.(event)
          if (!event.defaultPrevented) {
            setApplyDefaultRules(false)
            setOpen(true)
          }
        },
      })}
      <DialogContent className="max-h-[min(90vh,560px)] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cerrar torneo</DialogTitle>
          <DialogDescription className="text-pretty">
            {tournamentName}: se guardara un snapshot de la clasificacion por grupo y el estado pasara a{' '}
            <span className="font-medium">cerrado</span>. Este paso libera el flujo para crear o activar el siguiente
            torneo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border-y border-slate-100 py-4">
          {blockersQ.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin" />
              Comprobando partidos y resultados…
            </p>
          ) : blockersQ.isError ? (
            <p className="text-sm text-red-800">
              {blockersQ.error instanceof Error ? blockersQ.error.message : 'Error al validar el cierre.'}
            </p>
          ) : blockers ? (
            <>
              {!canClose ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
                  <p className="flex gap-2 font-semibold">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    Cierre con pendientes detectados.
                  </p>
                  {blockers.messages.length > 0 ? (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-[13px] leading-snug">
                      {blockers.messages.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[13px]">Hay partidos u operaciones pendientes.</p>
                  )}
                  {canCloseWithDefaultRules ? (
                    <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-amber-200 bg-white/70 px-3 py-2 text-[13px] leading-snug text-amber-950">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 rounded border-amber-300 text-amber-700"
                        checked={applyDefaultRules}
                        onChange={(event) => setApplyDefaultRules(event.target.checked)}
                      />
                      <span>
                        Cerrar partidos sin marcador como <span className="font-semibold">doble penalizacion</span>.
                        Aplica los puntos de regla para no reportado y deja el torneo listo para cierre.
                      </span>
                    </label>
                  ) : (
                    <div className="mt-3">
                      <Link
                        to="/admin/matches"
                        className={buttonVariants({ variant: 'outline', size: 'sm', className: 'inline-flex w-full justify-center sm:w-auto' })}
                      >
                        Ir a resultados pendientes
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-emerald-900">
                  Listo para cerrar: no hay partidos abiertos ni marcadores en flujo pendiente.
                </p>
              )}
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                <dt>Marcador pendiente</dt>
                <dd className="text-right font-medium text-slate-900">{blockers.counts.pendingScore}</dd>
                <dt>Sin marcador aplicable</dt>
                <dd className="text-right font-medium text-slate-900">{blockers.counts.pendingScoreWithoutMarker}</dd>
                <dt>Resultado provisional</dt>
                <dd className="text-right font-medium text-slate-900">{blockers.counts.scoreSubmitted}</dd>
                <dt>Disputas</dt>
                <dd className="text-right font-medium text-slate-900">{blockers.counts.scoreDisputed}</dd>
                <dt>Validación admin</dt>
                <dd className="text-right font-medium text-slate-900">{blockers.counts.playerConfirmed}</dd>
                <dt>Partidos no cerrados</dt>
                <dd className="text-right font-medium text-slate-900">{blockers.counts.openMatches}</dd>
              </dl>
            </>
          ) : null}
        </div>

        <DialogFooter className="gap-2 pt-4 sm:gap-2">
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button
            variant="destructive"
            disabled={
              disabled ||
              closeMut.isPending ||
              blockersQ.isLoading ||
              !canConfirmClose ||
              !closedBy ||
              blockersQ.isError
            }
            onClick={() => closeMut.mutate()}
          >
            {closeMut.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Cerrando…
              </>
            ) : (
              'Confirmar cierre'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
