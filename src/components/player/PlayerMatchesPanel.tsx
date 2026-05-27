import { ClipboardList } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { PlayerMatchActionCard } from '@/components/player/PlayerMatchActionCard'
import { PlayerRegisteredMatchCard } from '@/components/player/PlayerRegisteredMatchCard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  canRejectScore,
  canSubmitScore,
} from '@/lib/matchStatus'
import { partitionPlayerMatches } from '@/lib/playerMatchPartitions'
import { patchPlayerViewModelAfterOpponentReject } from '@/lib/playerDashboardMatchCache'
import {
  PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH,
  validatePlayerScoreDisputeReason,
} from '@/lib/playerScoreDispute'
import { cn } from '@/lib/utils'
import { rejectPlayerScore } from '@/services/matches'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'

function sortTimelineAsc(a: MatchRow, b: MatchRow) {
  const ta = new Date(a.created_at).getTime()
  const tb = new Date(b.created_at).getTime()
  return ta - tb
}

function sortTimelineDesc(a: MatchRow, b: MatchRow) {
  const ta = new Date(a.score_submitted_at ?? a.updated_at ?? a.created_at).getTime()
  const tb = new Date(b.score_submitted_at ?? b.updated_at ?? b.created_at).getTime()
  return tb - ta
}

function pendingActionsHeading(n: number) {
  if (n === 1) return 'Tienes 1 acción pendiente'
  return `Tienes ${n} acciones pendientes`
}

function TabCount({ n, active }: { n: number; active: boolean }) {
  if (n <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex min-h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums transition-colors',
        active ? 'bg-[#1F5A4C] text-white shadow-sm' : 'bg-[#102A43]/[0.08] text-[#475569]',
      )}
      aria-hidden
    >
      {n}
    </span>
  )
}

export function PlayerMatchesPanel({
  id = 'player-section-matches',
  matches,
  players,
  myGroupPlayerId,
  userId,
  rules,
  groupName,
  groupKey,
  onAfterMatchMutation,
  className,
}: {
  id?: string
  matches: MatchRow[]
  players: GroupPlayer[]
  myGroupPlayerId: string
  userId: string
  rules: TournamentRules
  groupName: string
  /** Reset pestaña al cambiar de grupo. */
  groupKey: string
  onAfterMatchMutation: (payload: { match: MatchRow }) => void
  className?: string
}) {
  const { pendientes, enProceso, historial } = useMemo(
    () => partitionPlayerMatches(matches, myGroupPlayerId, userId, rules),
    [matches, myGroupPlayerId, userId, rules],
  )

  const pendSorted = useMemo(() => [...pendientes].sort(sortTimelineAsc), [pendientes])

  const registradosSorted = useMemo(() => {
    const merged = [...enProceso, ...historial]
    return merged.sort(sortTimelineDesc)
  }, [enProceso, historial])

  const registradosCount = enProceso.length + historial.length

  const defaultTab = pendientes.length > 0 ? 'pendientes' : 'registrados'
  const [tabState, setTabState] = useState<{ groupKey: string; value: 'pendientes' | 'registrados' }>(() => ({
    groupKey,
    value: defaultTab,
  }))
  const tab = tabState.groupKey === groupKey ? tabState.value : defaultTab
  const setTab = useCallback(
    (value: 'pendientes' | 'registrados') => setTabState({ groupKey, value }),
    [groupKey],
  )

  const relayAfterMutation = useCallback(
    (payload: { match: MatchRow }) => {
      setTab('registrados')
      onAfterMatchMutation(payload)
    },
    [onAfterMatchMutation, setTab],
  )

  const qc = useQueryClient()
  const [refuteTarget, setRefuteTarget] = useState<MatchRow | null>(null)
  const [refuteReason, setRefuteReason] = useState('')
  const [refuteBusy, setRefuteBusy] = useState(false)
  const refuteInFlightRef = useRef(false)

  const submitRegisteredRefute = useCallback(async () => {
    const target = refuteTarget
    if (!target || refuteInFlightRef.current) return
    const parsed = validatePlayerScoreDisputeReason(refuteReason)
    if (!parsed.ok) {
      toast.error(parsed.message)
      return
    }
    refuteInFlightRef.current = true
    setRefuteBusy(true)
    try {
      const serverMatch = await rejectPlayerScore({ matchId: target.id, disputeReason: parsed.reason })
      const merged = patchPlayerViewModelAfterOpponentReject(qc, userId, serverMatch ?? target, parsed.reason)
      void qc.invalidateQueries({ queryKey: ['admin-disputed-results'] })
      void qc.invalidateQueries({ queryKey: ['admin-results'] })
      void qc.invalidateQueries({ queryKey: ['admin-matches'] })
      void qc.invalidateQueries({ queryKey: ['admin-overview'] })
      toast.message('Resultado refutado', {
        description: 'Organización revisará el marcador y podrá validarlo o corregirlo.',
      })
      setRefuteTarget(null)
      setRefuteReason('')
      relayAfterMutation({ match: merged })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo refutar el marcador')
    } finally {
      refuteInFlightRef.current = false
      setRefuteBusy(false)
    }
  }, [refuteTarget, refuteReason, qc, userId, relayAfterMutation])

  return (
    <section
      id={id}
      data-name={id}
      className={cn('overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm ring-1 ring-black/[0.03]', className)}
    >
      <div className="border-b border-[#E2E8F0] px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-start gap-2 sm:items-center">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#F6F3EE] text-[#1F5A4C] sm:size-9">
            <ClipboardList className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#102A43] sm:text-lg">Mis partidos</h2>
            <p className="text-xs leading-snug text-[#64748B] sm:text-sm">
              Pendientes por capturar o refutados, y partidos ya registrados en este grupo.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div
          className={cn(
            'rounded-xl border px-3 py-2',
            pendientes.length > 0
              ? 'border-amber-200/90 bg-amber-50/90 text-amber-950'
              : 'border-emerald-200/90 bg-emerald-50/70 text-emerald-950',
          )}
        >
          {pendientes.length > 0 ? (
            <p className="text-sm font-medium">{pendingActionsHeading(pendientes.length)}</p>
          ) : (
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Todo al día</p>
              <p className="text-xs text-emerald-900/80">No tienes marcadores pendientes por ahora.</p>
            </div>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList
            variant="default"
            className={cn(
              'mb-2 grid h-auto min-h-12 w-full grid-cols-2 gap-1 rounded-xl border border-[#E2E8F0]/90 bg-[#F6F3EE]/65 p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] sm:mb-3 sm:flex sm:min-h-[3.25rem]',
              '[&_[data-slot=tabs-trigger]]:shadow-none [&_[data-slot=tabs-trigger]]:after:hidden',
            )}
            aria-label="Tipo de partidos"
          >
            <TabsTrigger
              value="pendientes"
              className={cn(
                'relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2.5 touch-manipulation sm:min-h-0 sm:flex-1 sm:flex-row sm:gap-2 sm:px-3 sm:py-2',
                'border border-transparent text-xs font-semibold text-[#64748B]',
                'transition-[color,background-color,box-shadow,transform] duration-200 ease-out',
                'hover:bg-white/55 hover:text-[#102A43]',
                'focus-visible:ring-[3px] focus-visible:ring-[#1F5A4C]/25',
                'data-[active]:border-[#E2E8F0]/90 data-[active]:bg-white data-[active]:text-[#1F5A4C]',
                'data-[active]:shadow-sm data-[active]:ring-1 data-[active]:ring-[#1F5A4C]/12',
                'sm:text-sm',
              )}
            >
              <span className="leading-tight">Pendientes</span>
              <TabCount n={pendientes.length} active={tab === 'pendientes'} />
            </TabsTrigger>
            <TabsTrigger
              value="registrados"
              className={cn(
                'relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2.5 touch-manipulation sm:min-h-0 sm:flex-1 sm:flex-row sm:gap-2 sm:px-3 sm:py-2',
                'border border-transparent text-xs font-semibold text-[#64748B]',
                'transition-[color,background-color,box-shadow,transform] duration-200 ease-out',
                'hover:bg-white/55 hover:text-[#102A43]',
                'focus-visible:ring-[3px] focus-visible:ring-[#1F5A4C]/25',
                'data-[active]:border-[#E2E8F0]/90 data-[active]:bg-white data-[active]:text-[#1F5A4C]',
                'data-[active]:shadow-sm data-[active]:ring-1 data-[active]:ring-[#1F5A4C]/12',
                'sm:text-sm',
              )}
            >
              <span className="leading-tight">Registrados</span>
              <TabCount n={registradosCount} active={tab === 'registrados'} />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendientes" className="mt-3 space-y-2.5 outline-none sm:space-y-3">
            {pendSorted.length === 0 ? (
              <EmptyTab text="No tienes acciones pendientes en este momento." />
            ) : (
              pendSorted.map((m) => (
                <PlayerMatchActionCard
                  key={m.id}
                  match={m}
                  players={players}
                  rules={rules}
                  myGroupPlayerId={myGroupPlayerId}
                  userId={userId}
                  groupName={groupName}
                  onAfterMatchMutation={relayAfterMutation}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="registrados" className="mt-3 space-y-2.5 outline-none sm:space-y-3">
            {registradosSorted.length === 0 ? (
              <EmptyTab text="Aún no tienes partidos registrados en este grupo." />
            ) : (
              <ul className="space-y-2.5 sm:space-y-3">
                {registradosSorted.map((m) => {
                  const officialCounted =
                    (m.status === 'closed' || m.status === 'validated') && m.winner_id != null
                  const cancelled = m.status === 'cancelled'
                  const showResponderCard =
                    rules.allow_player_score_entry &&
                    (canSubmitScore(m, userId) || canRejectScore(m, userId))

                  if (
                    m.status !== 'score_disputed' &&
                    !officialCounted &&
                    !cancelled &&
                    showResponderCard
                  ) {
                    return (
                      <li key={m.id}>
                        <PlayerMatchActionCard
                          match={m}
                          players={players}
                          rules={rules}
                          myGroupPlayerId={myGroupPlayerId}
                          userId={userId}
                          groupName={groupName}
                          onAfterMatchMutation={relayAfterMutation}
                        />
                      </li>
                    )
                  }

                  const canRefuteRegistered =
                    officialCounted &&
                    m.status === 'closed' &&
                    !cancelled &&
                    rules.allow_player_score_entry &&
                    canRejectScore(m, userId)

                  return (
                    <li key={m.id}>
                      <PlayerRegisteredMatchCard
                        match={m}
                        groupName={groupName}
                        myGroupPlayerId={myGroupPlayerId}
                        players={players}
                        rules={rules}
                        viewerUserId={userId}
                        onRefute={
                          canRefuteRegistered
                            ? () => {
                                setRefuteTarget(m)
                                setRefuteReason('')
                              }
                            : undefined
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={refuteTarget != null}
        onOpenChange={(open) => {
          if (!open && refuteBusy) return
          if (!open) {
            setRefuteTarget(null)
            setRefuteReason('')
          }
        }}
      >
        <DialogContent
          showCloseButton={!refuteBusy}
          className="flex max-h-[min(100dvh-1rem,32rem)] w-[min(100vw-1rem,28rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <DialogHeader className="shrink-0 space-y-2 px-4 pb-2 pt-5 pr-12">
            <DialogTitle className="text-base">Refutar resultado</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed sm:text-sm">
              Explica el motivo; organización revisará el incidente y definirá el marcador oficial.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            <Textarea
              value={refuteReason}
              onChange={(e) => setRefuteReason(e.target.value)}
              placeholder="Ej.: Los sets no coinciden con lo jugado…"
              maxLength={PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH}
              className="min-h-28 text-base sm:text-sm"
              aria-label="Motivo de la refutación"
              aria-invalid={
                refuteReason.trim().length > 0 && !validatePlayerScoreDisputeReason(refuteReason).ok
              }
            />
          </div>
          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full touch-manipulation sm:w-auto sm:min-h-10"
              disabled={refuteBusy}
              onClick={() => {
                setRefuteTarget(null)
                setRefuteReason('')
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 w-full touch-manipulation sm:w-auto sm:min-h-10"
              disabled={refuteBusy || refuteReason.trim().length < 3 || refuteReason.trim().length > PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH}
              onClick={() => void submitRegisteredRefute()}
            >
              Enviar refutación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function EmptyTab({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#E2E8F0] bg-[#F6F3EE]/35 px-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-[#94a3b8] shadow-sm ring-1 ring-[#E2E8F0]">
        <ClipboardList className="size-6 opacity-80" aria-hidden />
      </span>
      <p className="max-w-sm text-sm leading-relaxed text-[#64748B]">{text}</p>
    </div>
  )
}
