import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ScoreSubmissionModal } from '@/components/matches/ScoreSubmissionModal'
import { PlayerMatchFeedLayout } from '@/components/player/PlayerMatchFeedLayout'
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
import { gameTypeLabel } from '@/lib/playerMatchFeed'
import {
  canRejectScore,
  canSubmitScore,
  isMatchPlayerA,
} from '@/lib/matchStatus'
import {
  mergeMatchAfterPlayerSubmit,
  patchPlayerViewModelAfterOpponentReject,
  patchPlayerViewModelMatches,
} from '@/lib/playerDashboardMatchCache'
import {
  PLAYER_SCORE_DISPUTE_REASON_MAX_LENGTH,
  validatePlayerScoreDisputeReason,
} from '@/lib/playerScoreDispute'
import {
  preparePlayerScoreSubmissionSync,
  rejectPlayerScore,
  submitPlayerScore,
} from '@/services/matches'
import type { PlayerViewModel } from '@/services/playerViewModel'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'

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

  const canSubmit = rules.allow_player_score_entry && canSubmitScore(match, userId)
  const canReject = rules.allow_player_score_entry && canRejectScore(match, userId)

  const iSubmittedPending =
    match.status === 'score_submitted' &&
    (match.score_submitted_by === userId ||
      (match.score_submitted_by == null && isMatchPlayerA(match, userId)))

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
      const serverMatch = await rejectPlayerScore({ matchId: match.id, disputeReason: parsed.reason })
      const merged = patchPlayerViewModelAfterOpponentReject(qc, userId, serverMatch ?? match, parsed.reason)
      void qc.invalidateQueries({ queryKey: ['admin-disputed-results'] })
      void qc.invalidateQueries({ queryKey: ['admin-results'] })
      void qc.invalidateQueries({ queryKey: ['admin-matches'] })
      void qc.invalidateQueries({ queryKey: ['admin-overview'] })
      toast.message('Resultado refutado', {
        description: 'Organización revisará el marcador.',
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

  const actionFooter =
    canSubmit || canReject ? (
      <>
        {canSubmit ? (
          <Button className="h-9 w-full sm:w-auto" onClick={() => setScoreOpen(true)}>
            {match.status === 'score_disputed' ? 'Corregir y reenviar' : 'Registrar marcador'}
          </Button>
        ) : null}
        {canReject ? (
          <Button className="h-9 w-full sm:w-auto" variant="outline" disabled={busy} onClick={() => setRejectOpen(true)}>
            Refutar
          </Button>
        ) : null}
      </>
    ) : undefined

  return (
    <>
      <PlayerMatchFeedLayout
        match={match}
        players={players}
        userId={userId}
        groupName={groupName}
        metaLabel={gameTypeLabel(match.game_type)}
        iSubmittedPending={iSubmittedPending}
        footer={actionFooter}
        className={className}
        id={`player-match-action-${match.id}`}
      />

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
          try {
            const prepared = preparePlayerScoreSubmissionSync({ match, scorePayload, rules })
            const serverRow = await submitPlayerScore({ match, scorePayload, actorUserId: userId, rules })
            const merged = serverRow ?? mergeMatchAfterPlayerSubmit(match, prepared, userId)
            qc.setQueryData<PlayerViewModel | null>(['playerViewModel', userId, match.group_id], (old) =>
              patchPlayerViewModelMatches(old, userId, match.id, merged),
            )
            toast.success(
              match.status === 'score_disputed'
                ? 'Marcador reenviado'
                : 'Marcador registrado · ya cuenta como oficial en la tabla.',
            )
            setScoreOpen(false)
            onAfterMatchMutation({ match: merged })
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
              Explica el motivo; organización revisará y definirá el marcador oficial.
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
            <Button variant="outline" className="min-h-11 w-full sm:w-auto" disabled={busy} onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="min-h-11 w-full sm:w-auto"
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
    </>
  )
}
