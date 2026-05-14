import { ClipboardList } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PlayerMatchActionCard } from '@/components/player/PlayerMatchActionCard'
import { buttonVariants } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
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
import { cn } from '@/lib/utils'
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
  return 'Al mejor de 3'
}

function outcomeLine(match: MatchRow, myGroupPlayerId: string, resultType: MatchResultType | null): string {
  if (match.winner_id == null) return '—'
  const isDefault = resultType && resultType !== 'normal'
  const w = getMatchOutcome(match, myGroupPlayerId)
  if (isDefault) {
    if (w === 'win') return 'Ganaste (W.O.)'
    if (w === 'loss') return 'Perdiste (W.O.)'
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

function enProcesoCopy(match: MatchRow, userId: string): { estado: string; marcador?: string } {
  const marcador =
    match.score_raw?.length || match.game_type === 'sudden_death'
      ? getPlayerPerspectiveScore(match, userId)
      : undefined

  if (match.status === 'pending_score') {
    return { estado: 'Pendiente de marcador', marcador }
  }
  if (match.status === 'player_confirmed') {
    return { estado: 'Pendiente de cierre por el organizador', marcador }
  }
  if (match.status === 'score_disputed') {
    const canFix = canSubmitScore(match, userId)
    return {
      estado: canFix ? 'Corregí tu marcador para reenviar' : 'En disputa · esperando al rival',
      marcador,
    }
  }
  if (match.status === 'score_submitted') {
    const iSubmitted =
      match.score_submitted_by === userId ||
      (match.score_submitted_by == null && isMatchPlayerA(match, userId))
    return {
      estado: iSubmitted ? 'Marcador enviado · esperando aceptación' : 'Marcador enviado',
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

export function PlayerMatchesPanel({
  id = 'player-section-matches',
  matches,
  players,
  myGroupPlayerId,
  userId,
  rules,
  groupName,
  groupDetailHref,
  groupKey,
  onAfterAction,
  className,
}: {
  id?: string
  matches: MatchRow[]
  players: GroupPlayer[]
  myGroupPlayerId: string
  userId: string
  rules: TournamentRules
  groupName: string
  groupDetailHref: string
  /** Reset pestaña al cambiar de grupo. */
  groupKey: string
  onAfterAction: () => Promise<void>
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

  useEffect(() => {
    setTab(pendientes.length > 0 ? 'pendientes' : 'registrados')
  }, [groupKey])

  return (
    <section
      id={id}
      data-name={id}
      className={cn('overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm', className)}
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
              'mb-2 flex h-auto min-h-11 w-full gap-1 rounded-xl border border-[#E2E8F0]/90 bg-[#F6F3EE]/65 p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] sm:min-h-12',
              '[&_[data-slot=tabs-trigger]]:shadow-none [&_[data-slot=tabs-trigger]]:after:hidden',
            )}
            aria-label="Tipo de partidos"
          >
            <TabsTrigger
              value="pendientes"
              className={cn(
                'relative flex flex-1 flex-col gap-0.5 rounded-lg px-2 py-2 sm:flex-row sm:items-center sm:justify-center sm:gap-2 sm:px-3',
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
                'relative flex flex-1 flex-col gap-0.5 rounded-lg px-2 py-2 sm:flex-row sm:items-center sm:justify-center sm:gap-2 sm:px-3',
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
                  onAfterAction={onAfterAction}
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
                  const official = m.status === 'closed' && m.winner_id != null
                  const cancelled = m.status === 'cancelled'

                  if (official || cancelled) {
                    const pts = official ? getPointsForPlayerInMatch(m, myGroupPlayerId, rules) : null
                    const gamesDiff = official ? calculateMatchGamesDifference(myGroupPlayerId, m) : null
                    const label = getPlayerPerspectiveScore(m, userId)
                    const out = outcomeLine(m, myGroupPlayerId, m.result_type)
                    const tone = matchStatusToneClasses[m.status]

                    return (
                      <li
                        key={m.id}
                        className="rounded-xl border border-[#E2E8F0] bg-gradient-to-br from-white to-[#F8FAFC] px-3 py-2.5 shadow-sm sm:px-4 sm:py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#102A43]">Vs. {rival?.display_name ?? 'Rival'}</p>
                            {cancelled ? (
                              <p className="mt-0.5 text-xs font-medium text-[#64748B]">Partido cancelado</p>
                            ) : (
                              <>
                                <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                                  {out} · {label}
                                </p>
                                {pts != null && gamesDiff != null ? (
                                  <p className="mt-1 text-xs font-semibold text-[#1F5A4C]">
                                    {pointsPhrase(pts)} · Dif. {signed(gamesDiff)}
                                  </p>
                                ) : null}
                              </>
                            )}
                            <p className="mt-1 text-[11px] text-[#94a3b8]">{gameTypeLabel(m.game_type)}</p>
                          </div>
                          <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold', tone)}>
                            {official ? 'Resultado oficial' : matchStatusLabels[m.status]}
                          </span>
                        </div>
                        {official ? (
                          <div className="mt-2 flex justify-end">
                            <Link
                              to={groupDetailHref}
                              className={buttonVariants({
                                variant: 'ghost',
                                size: 'sm',
                                className: 'h-8 text-[#1F5A4C]',
                              })}
                            >
                              Ver detalle
                            </Link>
                          </div>
                        ) : null}
                      </li>
                    )
                  }

                  const { estado, marcador } = enProcesoCopy(m, userId)
                  const tone = matchStatusToneClasses[m.status]
                  return (
                    <li
                      key={m.id}
                      className="rounded-xl border border-[#E2E8F0] bg-gradient-to-br from-white to-[#F8FAFC] px-3 py-2.5 shadow-sm sm:px-4 sm:py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#102A43]">Vs. {rival?.display_name ?? 'Rival'}</p>
                          <p className="mt-0.5 text-xs font-medium text-[#64748B]">{estado}</p>
                          {marcador && marcador !== '—' ? (
                            <p className="mt-1 font-mono text-sm font-semibold text-[#102A43]">{marcador}</p>
                          ) : null}
                          <p className="mt-1 text-[11px] text-[#94a3b8]">{gameTypeLabel(m.game_type)}</p>
                        </div>
                        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold', tone)}>
                          {matchStatusLabels[m.status]}
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
    </section>
  )
}

function EmptyTab({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F6F3EE]/40 px-4 py-6 text-center text-sm text-[#64748B]">
      {text}
    </p>
  )
}
