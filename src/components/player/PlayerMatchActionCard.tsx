import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ScoreSubmissionModal } from '@/components/matches/ScoreSubmissionModal'
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
import { Textarea } from '@/components/ui/textarea'
import {
  canRejectScore,
  canSubmitScore,
  getOpponentInMatch,
  isMatchPlayerA,
  isPendingScoreStatus,
  matchDisplayStatus,
  matchStatusLabels,
  matchStatusToneClasses,
} from '@/lib/matchStatus'
import { getPlayerPerspectiveScore } from '@/lib/matchUserPerspective'
import {
  mergeMatchAfterPlayerSubmit,
  patchPlayerViewModelAfterOpponentReject,
  patchPlayerViewModelMatches,
} from '@/lib/playerDashboardMatchCache'
import {
  PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH,
  validatePlayerScoreDisputeReason,
} from '@/lib/playerScoreDispute'
import { isPlayerSubmitPerfEnabled } from '@/lib/playerSubmitPerf'
import { cn } from '@/lib/utils'
import {
  preparePlayerScoreSubmissionSync,
  rejectPlayerScore,
  submitPlayerScore,
} from '@/services/matches'
import type { PlayerViewModel } from '@/services/playerViewModel'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'

function StatusBadge({ match }: { match: MatchRow }) {
  const displayStatus = matchDisplayStatus(match) as MatchRow['status']
  const isOfficialLike = match.status === 'closed' || match.status === 'validated'
  const label = isOfficialLike
    ? match.status === 'validated'
      ? matchStatusLabels.validated
      : matchStatusLabels.closed
    : matchStatusLabels[displayStatus]
  const tone = isOfficialLike
    ? match.status === 'validated'
      ? matchStatusToneClasses.validated
      : matchStatusToneClasses.closed
    : matchStatusToneClasses[displayStatus]
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', tone)}>
      {label}
    </span>
  )
}

/**
 * Acciones de marcador (enviar / refutar):
 * 1) RPC crítico (await) → fila `closed` persistida.
 * 2) Parche React Query [`playerViewModel`, …] (+ dashboard torneo si está cacheado).
 * 3) Sin reconcile diferido: ver `PlayerDashboardPage.onMatchMutated`.
 */
export function PlayerMatchActionCard({
  match,
  players,
  rules,
  myGroupPlayerId,
  userId,
  groupName,
  onAfterMatchMutation,
  className,
}: {
  match: MatchRow
  players: GroupPlayer[]
  rules: TournamentRules
  myGroupPlayerId: string
  userId: string
  groupName: string
  onAfterMatchMutation: (payload: { match: MatchRow }) => void
  className?: string
}) {
  const qc = useQueryClient()
  const [scoreOpen, setScoreOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)
  const submitInFlightRef = useRef(false)
  const rejectInFlightRef = useRef(false)

  const rival = getOpponentInMatch(match, myGroupPlayerId, players)
  const perspectiveScore = getPlayerPerspectiveScore(match, myGroupPlayerId)
  const canSubmit = rules.allow_player_score_entry && canSubmitScore(match, userId)
  const canReject = rules.allow_player_score_entry && canRejectScore(match, userId)

  const iSubmittedPending =
    match.status === 'score_submitted' &&
    (match.score_submitted_by === userId ||
      (match.score_submitted_by == null && isMatchPlayerA(match, userId)))

  const actionCopy = (() => {
    if (match.status === 'cancelled') return 'Este partido fue cancelado.'
    if (match.status === 'score_disputed') {
      return 'Marcador en revisión administrativa. No cuenta para la tabla hasta que organización lo confirme o corrija.'
    }
    if (match.status === 'validated') {
      return 'Resultado validado por administración. Este marcador es oficial para la tabla del grupo.'
    }
    if (match.status === 'closed') {
      return canReject
        ? 'Marcador oficial para la tabla del grupo. Si no coincide con lo jugado, puedes refutarlo.'
        : 'Resultado oficial. Este marcador ya impacta el ranking.'
    }
    if (match.status === 'score_submitted') {
      return iSubmittedPending
        ? 'Marcador confirmado y registrado; ya cuenta para la tabla del grupo. Tu rival solo puede refutarlo si no coincide.'
        : 'Marcador confirmado por tu rival y ya cuenta para la tabla del grupo. Solo puedes refutarlo si no coincide.'
    }
    if (canSubmit) return 'El partido ya puede capturarse. Registra el marcador; quedará oficial para la tabla.'
    if (isPendingScoreStatus(match.status)) return 'Partido pendiente de marcador.'
    return 'Partido en seguimiento.'
  })()

  const handleReject = useCallback(async () => {
    if (rejectInFlightRef.current) return
    const parsed = validatePlayerScoreDisputeReason(rejectReason)
    if (!parsed.ok) {
      toast.error(parsed.message)
      return
    }
    rejectInFlightRef.current = true
    setBusy(true)
    try {
      await rejectPlayerScore({ matchId: match.id, disputeReason: parsed.reason })
      const merged = patchPlayerViewModelAfterOpponentReject(qc, userId, match, parsed.reason)
      toast.message('Resultado refutado', {
        description: 'Organización revisará el caso y definirá el marcador oficial.',
      })
      setRejectOpen(false)
      setRejectReason('')
      onAfterMatchMutation({ match: merged })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo refutar el marcador')
    } finally {
      rejectInFlightRef.current = false
      setBusy(false)
    }
  }, [rejectReason, match, userId, qc, onAfterMatchMutation])

  return (
    <article
      className={cn(
        'rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm ring-1 ring-black/[0.02] transition-shadow hover:shadow-md sm:p-5',
        className,
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">{groupName}</p>
          <StatusBadge match={match} />
        </div>

        <h3 className="break-words text-lg font-bold leading-tight text-[#102A43] sm:text-xl">vs. {rival?.display_name ?? 'Rival'}</h3>

        {match.score_raw?.length || match.game_type === 'sudden_death' ? (
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F6F3EE]/80 px-4 py-3 shadow-inner">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Marcador (tu lectura)</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums tracking-tight text-[#102A43] sm:text-[1.65rem]">
              {perspectiveScore}
            </p>
          </div>
        ) : null}

        <p className="text-sm font-medium leading-relaxed text-[#334155]">{actionCopy}</p>
      </div>

      {match.status === 'score_disputed' && match.dispute_reason ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">Motivo de la refutación</p>
          <p className="mt-1.5 leading-relaxed">{match.dispute_reason}</p>
        </div>
      ) : null}

      {(match.status === 'score_disputed' || match.status === 'validated') ? (
        <MatchScoreTimeline matchId={match.id} className="mt-2" />
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        {canSubmit ? (
          <Button className="min-h-11 w-full touch-manipulation sm:w-auto sm:min-h-10" onClick={() => setScoreOpen(true)}>
            {match.status === 'score_disputed' ? 'Corregir y reenviar' : 'Registrar marcador'}
          </Button>
        ) : null}
        {canReject ? (
          <Button
            className="min-h-11 w-full touch-manipulation sm:w-auto sm:min-h-10"
            variant="outline"
            disabled={busy}
            onClick={() => setRejectOpen(true)}
          >
            Refutar
          </Button>
        ) : null}
      </div>

      <ScoreSubmissionModal
        open={scoreOpen}
        onOpenChange={setScoreOpen}
        match={match}
        players={players}
        viewerGroupPlayerId={myGroupPlayerId}
        rules={rules}
        submitting={busy}
        submitLabel="Enviar marcador"
        onSubmit={async (scorePayload) => {
          if (submitInFlightRef.current) return
          submitInFlightRef.current = true
          setBusy(true)
          const perf = isPlayerSubmitPerfEnabled()
          const t0 = perf ? performance.now() : 0
          try {
            const prepared = preparePlayerScoreSubmissionSync({ match, scorePayload, rules })
            const tRpc = perf ? performance.now() : 0
            const serverRow = await submitPlayerScore({ match, scorePayload, actorUserId: userId, rules })
            if (perf) {
              console.debug(`[perf] submitPlayerScore RPC ${Math.round(performance.now() - tRpc)}ms`)
            }
            const tMerge = perf ? performance.now() : 0
            const merged = serverRow ?? mergeMatchAfterPlayerSubmit(match, prepared, userId)
            qc.setQueryData<PlayerViewModel | null>(['playerViewModel', userId, match.group_id], (old) =>
              patchPlayerViewModelMatches(old, userId, match.id, merged),
            )
            if (perf) {
              console.debug(`[perf] patchPlayerViewModelMatches ${Math.round(performance.now() - tMerge)}ms`)
            }
            toast.success(
              match.status === 'score_disputed'
                ? 'Marcador reenviado'
                : 'Marcador registrado: ya cuenta como resultado oficial en la tabla.',
            )
            setScoreOpen(false)
            const tNotify = perf ? performance.now() : 0
            onAfterMatchMutation({ match: merged })
            if (perf) {
              console.debug(
                `[perf] afterMutation hook ${Math.round(performance.now() - tNotify)}ms · total ${Math.round(performance.now() - t0)}ms`,
              )
            }
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo enviar el marcador')
          } finally {
            submitInFlightRef.current = false
            setBusy(false)
          }
        }}
      />

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          if (!open && busy) return
          setRejectOpen(open)
          if (!open) setRejectReason('')
        }}
      >
        <DialogContent
          showCloseButton={!busy}
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
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Ej.: Los sets no coinciden con lo jugado…"
              maxLength={PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH}
              className="min-h-28 text-base sm:text-sm"
              aria-label="Motivo de la refutación"
              aria-invalid={
                rejectReason.trim().length > 0 && !validatePlayerScoreDisputeReason(rejectReason).ok
              }
            />
          </div>
          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="min-h-11 w-full touch-manipulation sm:w-auto sm:min-h-10"
              disabled={busy}
              onClick={() => setRejectOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="min-h-11 w-full touch-manipulation sm:w-auto sm:min-h-10"
              disabled={
                busy ||
                rejectReason.trim().length < 3 ||
                rejectReason.trim().length > PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH
              }
              onClick={() => void handleReject()}
            >
              Enviar refutación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}
