import { useState } from 'react'
import { toast } from 'sonner'

import { ScoreSubmissionModal } from '@/components/matches/ScoreSubmissionModal'
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
  canAcceptScore,
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
import { cn } from '@/lib/utils'
import { acceptPlayerScore, rejectPlayerScore, submitPlayerScore } from '@/services/matches'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'

function StatusBadge({ match }: { match: MatchRow }) {
  const displayStatus = matchDisplayStatus(match) as MatchRow['status']
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', matchStatusToneClasses[displayStatus])}>
      {matchStatusLabels[displayStatus]}
    </span>
  )
}

export function PlayerMatchActionCard({
  match,
  players,
  rules,
  myGroupPlayerId,
  userId,
  groupName,
  onAfterAction,
  className,
}: {
  match: MatchRow
  players: GroupPlayer[]
  rules: TournamentRules
  myGroupPlayerId: string
  userId: string
  groupName: string
  onAfterAction: () => Promise<void>
  className?: string
}) {
  const [scoreOpen, setScoreOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)

  const rival = getOpponentInMatch(match, myGroupPlayerId, players)
  const perspectiveScore = getPlayerPerspectiveScore(match, userId)
  const canSubmit = rules.allow_player_score_entry && canSubmitScore(match, userId)
  const canAccept = rules.allow_player_score_entry && canAcceptScore(match, userId)
  const canReject = rules.allow_player_score_entry && canRejectScore(match, userId)

  const iSubmittedPending =
    match.status === 'score_submitted' &&
    (match.score_submitted_by === userId ||
      (match.score_submitted_by == null && isMatchPlayerA(match, userId)))

  const actionCopy = (() => {
    if (match.status === 'closed') return 'Resultado oficial. Este marcador ya impacta el ranking.'
    if (match.status === 'cancelled') return 'Este partido fue cancelado.'
    if (match.status === 'score_disputed') {
      return canSubmit ? 'El rival rechazó el marcador. Revisa el motivo y corrige para reenviar.' : 'Marcador en revisión.'
    }
    if (match.status === 'score_submitted') {
      return iSubmittedPending
        ? 'Marcador enviado a tu rival. Cuando lo acepte, el resultado quedará confirmado por jugadores y pendiente del organizador.'
        : 'Tu rival envió el marcador. Revísalo y acéptalo si es correcto, o recházalo para que lo corrija.'
    }
    if (canSubmit) return 'El partido ya puede capturarse. Registra el marcador para enviarlo a tu rival.'
    if (isPendingScoreStatus(match.status)) return 'Partido pendiente de marcador.'
    return 'Partido en seguimiento.'
  })()

  const handleAccept = async () => {
    setBusy(true)
    try {
      await acceptPlayerScore(match.id)
      toast.success('Marcador aceptado. Queda pendiente la validación del organizador.')
      await onAfterAction()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo aceptar el marcador')
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    const reason = rejectReason.trim()
    if (reason.length < 3) {
      toast.error('Escribe el motivo del rechazo.')
      return
    }
    setBusy(true)
    try {
      await rejectPlayerScore({ matchId: match.id, disputeReason: reason })
      toast.message('Marcador rechazado', {
        description: 'El jugador que envió el marcador podrá corregirlo y reenviarlo.',
      })
      setRejectOpen(false)
      setRejectReason('')
      await onAfterAction()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo rechazar el marcador')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      className={cn(
        'rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{groupName}</p>
            <StatusBadge match={match} />
          </div>
          <h3 className="truncate text-base font-semibold text-[#102A43]">vs. {rival?.display_name ?? 'Rival'}</h3>
          <p className="text-sm font-medium leading-snug text-[#102A43]">{actionCopy}</p>
        </div>
        {match.score_raw?.length || match.game_type === 'sudden_death' ? (
          <div className="rounded-xl bg-[#F6F3EE]/70 px-3 py-2 text-left sm:text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">Marcador</p>
            <p className="font-mono text-lg font-semibold text-[#102A43]">{perspectiveScore}</p>
          </div>
        ) : null}
      </div>

      {match.status === 'score_disputed' && canSubmit && match.dispute_reason ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="text-xs font-semibold uppercase tracking-wide">Motivo del rechazo</p>
          <p className="mt-1">{match.dispute_reason}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        {canSubmit ? (
          <Button className="w-full sm:w-auto" onClick={() => setScoreOpen(true)}>
            {match.status === 'score_disputed' ? 'Corregir y reenviar' : 'Registrar marcador'}
          </Button>
        ) : null}
        {canAccept ? (
          <Button className="w-full sm:w-auto" disabled={busy} onClick={handleAccept}>
            Aceptar marcador
          </Button>
        ) : null}
        {canReject ? (
          <Button className="w-full sm:w-auto" variant="outline" disabled={busy} onClick={() => setRejectOpen(true)}>
            Rechazar
          </Button>
        ) : null}
      </div>

      <ScoreSubmissionModal
        open={scoreOpen}
        onOpenChange={setScoreOpen}
        match={match}
        players={players}
        rules={rules}
        submitting={busy}
        submitLabel={match.status === 'score_disputed' ? 'Reenviar marcador' : 'Enviar marcador'}
        onSubmit={async (scorePayload) => {
          setBusy(true)
          try {
            await submitPlayerScore({ match, scorePayload, actorUserId: userId })
            toast.success(match.status === 'score_disputed' ? 'Marcador reenviado' : 'Marcador enviado. Esperando a tu rival.')
            setScoreOpen(false)
            await onAfterAction()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo enviar el marcador')
          } finally {
            setBusy(false)
          }
        }}
      />

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar marcador</DialogTitle>
            <DialogDescription>
              Escribe el motivo del rechazo para que tu rival pueda corregir y reenviar.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Motivo del rechazo"
            className="min-h-28"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={busy || rejectReason.trim().length < 3} onClick={handleReject}>
              Rechazar marcador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}
