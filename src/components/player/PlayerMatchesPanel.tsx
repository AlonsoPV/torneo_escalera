import { ClipboardList } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { PlayerMatchActionCard } from '@/components/player/PlayerMatchActionCard'
import { MatchScoreTimeline } from '@/components/player/MatchScoreTimeline'
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
  getOpponentInMatch,
  isMatchPlayerA,
  matchStatusLabels,
  matchStatusToneClasses,
} from '@/lib/matchStatus'
import { getPlayerPerspectiveScore } from '@/lib/matchUserPerspective'
import {
  calculateMatchGamesDifference,
  getMatchOutcome,
  getPointsForPlayerInMatch,
} from '@/lib/playerDashboard'
import { partitionPlayerMatches } from '@/lib/playerMatchPartitions'
import { patchPlayerViewModelAfterOpponentReject } from '@/lib/playerDashboardMatchCache'
import {
  PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH,
  validatePlayerScoreDisputeReason,
} from '@/lib/playerScoreDispute'
import {
  importResultTypeBothPenalized,
  importResultTypeUsesDefaultPoints,
} from '@/lib/matchResultSemantics'
import { cn } from '@/lib/utils'
import { rejectPlayerScore } from '@/services/matches'
import type { GroupPlayer, MatchGameType, MatchResultType, MatchRow, TournamentRules } from '@/types/database'

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

function gameTypeLabel(gt: MatchGameType | null | undefined): string {
  if (gt === 'long_set') return 'Set largo'
  if (gt === 'sudden_death') return 'Muerte súbita'
  if (gt === 'best_of_3_short_tiebreak') return '2 de 3 (tie-break corto)'
  return 'Al mejor de 3'
}

function outcomeLine(match: MatchRow, myGroupPlayerId: string, resultType: MatchResultType | null): string {
  if (importResultTypeBothPenalized(match.result_type)) return 'No reportado · penalización'
  if (match.winner_id == null) return '—'
  const walkoverLike = importResultTypeUsesDefaultPoints(resultType)
  const w = getMatchOutcome(match, myGroupPlayerId)
  if (walkoverLike) {
    if (w === 'win') return 'Ganaste (W.O./DEF)'
    if (w === 'loss') return 'Perdiste (W.O./DEF)'
  }
  if (resultType === 'retired') {
    if (w === 'win') return 'Ganaste (retiro)'
    if (w === 'loss') return 'Perdiste (retiro)'
  }
  if (w === 'win') return 'Ganaste'
  if (w === 'loss') return 'Perdiste'
  return '—'
}

function signed(n: number) {
  if (n > 0) return `+${n}`
  return String(n)
}

function pointsPhrase(points: number) {
  const sign = points >= 0 ? '+' : ''
  return `${sign}${points} ${Math.abs(points) === 1 ? 'pt' : 'pts'}`
}

function pendingActionsHeading(n: number) {
  if (n === 1) return 'Tienes 1 acción pendiente'
  return `Tienes ${n} acciones pendientes`
}

function enProcesoCopy(match: MatchRow, userId: string, myGroupPlayerId: string): { estado: string; marcador?: string } {
  const marcador =
    match.score_raw?.length || match.game_type === 'sudden_death'
      ? getPlayerPerspectiveScore(match, myGroupPlayerId)
      : undefined

  if (match.status === 'pending_score') {
    return { estado: 'Pendiente de marcador', marcador }
  }
  if (match.status === 'player_confirmed') {
    return { estado: 'Pendiente de cierre por el organizador', marcador }
  }
  if (match.status === 'score_disputed') {
    return {
      estado: 'En revisión administrativa · el marcador no cuenta para la tabla',
      marcador,
    }
  }
  if (match.status === 'score_submitted') {
    const iSubmitted =
      match.score_submitted_by === userId ||
      (match.score_submitted_by == null && isMatchPlayerA(match, userId))
    return {
      estado: iSubmitted
        ? 'Resultado provisional · tu rival puede refutar'
        : 'Resultado provisional · puedes confirmar o refutar',
      marcador,
    }
  }
  return { estado: matchStatusLabels[match.status], marcador }
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

function MatchDetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-l-2 border-[#1F5A4C]/20 pl-2.5 sm:flex-row sm:items-baseline sm:gap-3 sm:border-l-0 sm:pl-0">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
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

  const [tab, setTab] = useState<'pendientes' | 'registrados'>(
    pendientes.length > 0 ? 'pendientes' : 'registrados',
  )

  const relayAfterMutation = useCallback(
    (payload: { match: MatchRow }) => {
      setTab('registrados')
      onAfterMatchMutation(payload)
    },
    [onAfterMatchMutation],
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
      await rejectPlayerScore({ matchId: target.id, disputeReason: parsed.reason })
      const merged = patchPlayerViewModelAfterOpponentReject(qc, userId, target, parsed.reason)
      toast.message('Resultado refutado', {
        description: 'Organización revisará el caso y definirá el marcador oficial.',
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

  useEffect(() => {
    setTab(pendientes.length > 0 ? 'pendientes' : 'registrados')
  }, [groupKey])

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
              Pendientes por cerrar y partidos ya registrados en este grupo.
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

          <TabsContent value="pendientes" className="mt-3 space-y-3 outline-none">
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
                  className="p-3 sm:p-4"
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="registrados" className="mt-3 space-y-2 outline-none">
            {registradosSorted.length === 0 ? (
              <EmptyTab text="Aún no tienes partidos registrados en este grupo." />
            ) : (
              <ul className="space-y-2">
                {registradosSorted.map((m) => {
                  const rival = getOpponentInMatch(m, myGroupPlayerId, players)

                  if (m.status === 'score_disputed') {
                    const label = getPlayerPerspectiveScore(m, myGroupPlayerId)
                    const disputeTone = matchStatusToneClasses.score_disputed
                    return (
                      <li
                        key={m.id}
                        className="rounded-2xl border border-[#E2E8F0] bg-gradient-to-br from-white to-[#F8FAFC] p-3 shadow-sm ring-1 ring-black/[0.02] sm:p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="min-w-0 flex-1 space-y-2.5">
                            <p className="text-base font-bold leading-tight text-[#102A43] sm:text-[1.05rem]">
                              Vs. {rival?.display_name ?? 'Rival'}
                            </p>
                            <MatchDetailRow label="Estado">
                              <span className="text-sm font-medium text-[#92400e]">
                                Resultado pendiente de revisión administrativa. El marcador no cuenta para la tabla hasta que
                                organización resuelva la disputa.
                              </span>
                            </MatchDetailRow>
                            {label !== '—' ? (
                              <MatchDetailRow label="Marcador registrado">
                                <span className="font-mono text-base font-bold tabular-nums text-[#64748B]">{label}</span>
                              </MatchDetailRow>
                            ) : null}
                            {m.dispute_reason ? (
                              <MatchDetailRow label="Tu motivo / motivo del rival">
                                <span className="text-sm text-[#334155]">{m.dispute_reason}</span>
                              </MatchDetailRow>
                            ) : null}
                            <p className="text-[11px] font-medium uppercase tracking-wide text-[#94a3b8]">
                              Formato · {gameTypeLabel(m.game_type)}
                            </p>
                            <MatchScoreTimeline matchId={m.id} />
                          </div>
                          <span
                            className={cn(
                              'inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold sm:mt-0.5',
                              disputeTone,
                            )}
                          >
                            Pendiente revisión
                          </span>
                        </div>
                      </li>
                    )
                  }

                  const officialCounted =
                    (m.status === 'closed' || m.status === 'validated') && m.winner_id != null
                  const cancelled = m.status === 'cancelled'

                  const showResponderCard =
                    rules.allow_player_score_entry &&
                    (canSubmitScore(m, userId) || canRejectScore(m, userId))

                  if (officialCounted || cancelled) {
                    const pts = officialCounted ? getPointsForPlayerInMatch(m, myGroupPlayerId, rules) : null
                    const gamesDiff = officialCounted ? calculateMatchGamesDifference(myGroupPlayerId, m) : null
                    const label = getPlayerPerspectiveScore(m, myGroupPlayerId)
                    const out = outcomeLine(m, myGroupPlayerId, m.result_type)
                    const tone = matchStatusToneClasses[m.status]
                    const canRefuteRegistered =
                      officialCounted &&
                      m.status === 'closed' &&
                      !cancelled &&
                      rules.allow_player_score_entry &&
                      canRejectScore(m, userId)

                    return (
                      <li
                        key={m.id}
                        className="rounded-2xl border border-[#E2E8F0] bg-gradient-to-br from-white to-[#F8FAFC] p-3 shadow-sm ring-1 ring-black/[0.02] sm:p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="min-w-0 flex-1 space-y-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-bold leading-tight text-[#102A43] sm:text-[1.05rem]">
                                Vs. {rival?.display_name ?? 'Rival'}
                              </p>
                            </div>
                            {cancelled ? (
                              <MatchDetailRow label="Estado">
                                <span className="text-sm font-medium text-[#64748B]">Partido cancelado</span>
                              </MatchDetailRow>
                            ) : officialCounted ? (
                              <>
                                <MatchDetailRow label="Resultado">
                                  <span className="text-sm font-semibold text-[#334155]">{out}</span>
                                </MatchDetailRow>
                                <MatchDetailRow label="Marcador">
                                  <span className="font-mono text-base font-bold tabular-nums text-[#102A43]">{label}</span>
                                </MatchDetailRow>
                                {pts != null && gamesDiff != null ? (
                                  <MatchDetailRow label="Puntos">
                                    <span className="text-sm font-semibold text-[#1F5A4C]">
                                      {pointsPhrase(pts)} · Juegos {signed(gamesDiff)}
                                    </span>
                                  </MatchDetailRow>
                                ) : null}
                              </>
                            ) : null}
                            <p className="text-[11px] font-medium uppercase tracking-wide text-[#94a3b8]">
                              Formato · {gameTypeLabel(m.game_type)}
                            </p>
                            {!cancelled && officialCounted ? <MatchScoreTimeline matchId={m.id} /> : null}
                          </div>
                          <span
                            className={cn(
                              'inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold sm:mt-0.5',
                              tone,
                            )}
                          >
                            {officialCounted
                              ? m.status === 'validated'
                                ? 'Validado'
                                : 'Resultado oficial'
                              : matchStatusLabels[m.status]}
                          </span>
                        </div>
                        {canRefuteRegistered ? (
                          <div className="mt-4 space-y-2 border-t border-[#E2E8F0]/80 pt-3">
                            <p className="text-xs leading-relaxed text-[#64748B]">
                              Si el marcador no coincide con lo jugado, puedes refutarlo; organización revisará y definirá el
                              resultado.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11 w-full touch-manipulation sm:w-auto sm:min-h-10"
                              onClick={() => {
                                setRefuteTarget(m)
                                setRefuteReason('')
                              }}
                            >
                              Refutar resultado
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    )
                  }

                  if (showResponderCard) {
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
                          className="p-3 sm:p-4"
                        />
                      </li>
                    )
                  }

                  const { estado, marcador } = enProcesoCopy(m, userId, myGroupPlayerId)
                  const badgeLabel =
                    m.status === 'closed'
                      ? matchStatusLabels.closed
                      : m.status === 'validated'
                        ? matchStatusLabels.validated
                      : m.status === 'score_submitted'
                        ? 'Confirmado'
                        : matchStatusLabels[m.status]
                  const toneSeg =
                    m.status === 'closed'
                      ? matchStatusToneClasses.closed
                      : m.status === 'validated'
                        ? matchStatusToneClasses.validated
                      : m.status === 'score_submitted'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : matchStatusToneClasses[m.status]
                  return (
                    <li
                      key={m.id}
                      className="rounded-2xl border border-[#E2E8F0] bg-gradient-to-br from-white to-[#F8FAFC] p-3 shadow-sm ring-1 ring-black/[0.02] sm:p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1 space-y-2.5">
                          <p className="text-base font-bold leading-tight text-[#102A43] sm:text-[1.05rem]">
                            Vs. {rival?.display_name ?? 'Rival'}
                          </p>
                          <MatchDetailRow label="Seguimiento">
                            <span className="text-sm font-medium text-[#475569]">{estado}</span>
                          </MatchDetailRow>
                          {marcador && marcador !== '—' ? (
                            <MatchDetailRow label="Marcador">
                              <span className="font-mono text-base font-bold tabular-nums text-[#102A43]">{marcador}</span>
                            </MatchDetailRow>
                          ) : null}
                          <p className="text-[11px] font-medium uppercase tracking-wide text-[#94a3b8]">
                            Formato · {gameTypeLabel(m.game_type)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold sm:mt-0.5',
                            toneSeg,
                          )}
                        >
                          {badgeLabel}
                        </span>
                      </div>
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
