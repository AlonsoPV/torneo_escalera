import { Ban, CheckCircle2, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AdminMatchRecord } from '@/services/admin'
import type { MatchStatus } from '@/types/database'

function formatScore(match: AdminMatchRecord) {
  return match.score_raw?.map((set) => `${set.a}-${set.b}`).join(' · ') ?? '—'
}

function shortDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

function statusShortLabel(status: MatchStatus): string {
  switch (status) {
    case 'pending_score':
      return 'Sin marcador'
    case 'score_submitted':
      return 'Confirmado · validación'
    case 'score_disputed':
      return 'Revisión disputa'
    case 'player_confirmed':
      return 'Pendiente validación'
    case 'closed':
      return 'Oficial jugador'
    case 'validated':
      return 'Validado admin'
    case 'cancelled':
      return 'Cancelado'
    default:
      return status
  }
}

function rowTone(status: MatchStatus): string {
  switch (status) {
    case 'closed':
      return 'border-green-200 bg-green-50/90 hover:bg-green-50'
    case 'validated':
      return 'border-emerald-200 bg-emerald-50/90 hover:bg-emerald-50'
    case 'player_confirmed':
      return 'border-yellow-200 bg-yellow-50/90 hover:bg-yellow-50'
    case 'score_disputed':
      return 'border-amber-200 bg-amber-50/90 hover:bg-amber-50'
    case 'score_submitted':
      return 'border-blue-200 bg-blue-50/90 hover:bg-blue-50'
    case 'pending_score':
      return 'border-neutral-200 bg-neutral-50/90 hover:bg-neutral-50'
    default:
      return 'border-slate-200 bg-slate-50/90 hover:bg-slate-50'
  }
}

function winnerLabel(match: AdminMatchRecord): string {
  if (match.winner_id === match.player_a_id) return match.playerAName
  if (match.winner_id === match.player_b_id) return match.playerBName
  return '—'
}

export function AdminResultReviewRow({
  match,
  quickReview,
  onConfirm,
  onCorrect,
  onValidateAsIs,
  onInvalidate,
}: {
  match: AdminMatchRecord
  quickReview: boolean
  onConfirm: (match: AdminMatchRecord) => void
  onCorrect: (match: AdminMatchRecord) => void
  onValidateAsIs?: (match: AdminMatchRecord) => void
  onInvalidate?: (match: AdminMatchRecord) => void
}) {
  const isDisputed = match.status === 'score_disputed'
  const canValidateLegacy = match.status === 'player_confirmed' || match.status === 'score_submitted'
  const tone = rowTone(match.status)

  const disputeSnippet =
    !quickReview && isDisputed
      ? [
          match.dispute_reason ? `Motivo: ${match.dispute_reason}` : null,
          match.disputedByLabel ? `Refutó: ${match.disputedByLabel}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : ''

  return (
    <article
      className={cn(
        'rounded-lg border px-2 py-1.5 shadow-sm transition-[box-shadow,transform] duration-200 hover:shadow-md sm:rounded-xl sm:px-2.5 sm:py-2',
        tone,
      )}
    >
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">{match.groupName}</span>
            <span
              className={cn(
                'rounded-full border px-1.5 py-px text-[10px] font-semibold tracking-tight',
                match.status === 'closed' && 'border-green-300 bg-white/80 text-green-900',
                match.status === 'validated' && 'border-emerald-300 bg-white/80 text-emerald-900',
                match.status === 'player_confirmed' && 'border-yellow-300 bg-white/80 text-yellow-900',
                match.status === 'score_disputed' && 'border-amber-300 bg-white/80 text-amber-950',
                match.status === 'score_submitted' && 'border-blue-300 bg-white/80 text-blue-900',
                match.status === 'pending_score' && 'border-neutral-300 bg-white/80 text-neutral-800',
                match.status === 'cancelled' && 'border-slate-300 bg-white/70 text-slate-700',
              )}
            >
              {statusShortLabel(match.status)}
            </span>
            {!quickReview ? (
              <span className="ml-auto shrink-0 tabular-nums text-[10px] font-medium text-slate-500">
                {shortDate(match.score_submitted_at)}
              </span>
            ) : null}
          </div>
          <p className="line-clamp-1 text-[13px] font-semibold leading-tight text-slate-950 sm:text-sm">
            <span className="uppercase tracking-tight">{match.playerAName}</span>{' '}
            <span className="font-normal text-slate-500">vs</span>{' '}
            <span className="uppercase tracking-tight">{match.playerBName}</span>
          </p>
          {!quickReview ? (
            isDisputed && disputeSnippet ? (
              <p
                className="line-clamp-2 text-[10px] font-medium leading-snug"
                title={`${match.tournamentName} · ${disputeSnippet}`}
              >
                <span className="text-slate-600">{match.tournamentName}</span>
                <span className="font-normal text-slate-400"> · </span>
                <span className="text-amber-950">{disputeSnippet}</span>
              </p>
            ) : (
              <p className="line-clamp-1 text-[10px] font-medium text-slate-600">{match.tournamentName}</p>
            )
          ) : null}
          {!quickReview && match.admin_notes ? (
            <p className="line-clamp-1 text-[10px] text-slate-600" title={match.admin_notes}>
              Nota: {match.admin_notes}
            </p>
          ) : null}
          {!quickReview && (match.status === 'closed' || match.status === 'validated') ? (
            <p className="text-[10px] text-slate-500">
              Cerrado {shortDate(match.admin_validated_at ?? match.closed_at)}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 border-t border-slate-200/60 pt-1.5 md:flex-1 md:flex-row md:items-center md:justify-end md:gap-3 md:border-l md:border-t-0 md:px-3 md:pt-0">
          <div className="min-w-0 shrink-0 md:max-w-[min(100%,14rem)]">
            <p className="font-mono text-[0.95rem] font-bold tabular-nums leading-none tracking-tight text-slate-950 sm:text-base">
              {formatScore(match)}
            </p>
            {!quickReview ? (
              <p className="mt-1 line-clamp-1 text-[10px] leading-tight text-slate-700" title={`Ganador: ${winnerLabel(match)} · Registró: ${match.scoreSubmittedByLabel ?? '—'}`}>
                <span className="font-medium text-slate-800">Gan.:</span>{' '}
                <span className="text-slate-950">{winnerLabel(match)}</span>
                <span className="text-slate-400"> · </span>
                <span className="font-medium text-slate-600">Reg.:</span>{' '}
                <span className="text-slate-800">{match.scoreSubmittedByLabel ?? '—'}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-[10px] font-medium text-slate-800">
                Gan.: <span className="text-slate-950">{winnerLabel(match)}</span>
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-1 md:justify-end">
            {isDisputed ? (
              <>
                <Button
                  size="xs"
                  title="Marcar como válido (sin cambiar marcador)"
                  className="border-transparent bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => onValidateAsIs?.(match)}
                  disabled={!onValidateAsIs}
                >
                  <CheckCircle2 className="size-3 opacity-90" />
                  Válido
                </Button>
                <Button
                  size="xs"
                  variant="destructive"
                  title="Invalidar partido (cancelado, fuera del ranking)"
                  onClick={() => onInvalidate?.(match)}
                  disabled={!onInvalidate}
                >
                  <Ban className="size-3 opacity-90" />
                  Invalidar
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  title="Corregir marcador"
                  className="border-slate-300 bg-white"
                  onClick={() => onCorrect(match)}
                >
                  <Pencil className="size-3 opacity-80" />
                  Corregir
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="xs"
                  disabled={!canValidateLegacy}
                  title={
                    canValidateLegacy
                      ? undefined
                      : 'Solo cuando el rival ya aceptó el marcador (pendiente de validación).'
                  }
                  className="border-transparent bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => onConfirm(match)}
                >
                  <CheckCircle2 className="size-3 opacity-90" />
                  Validar
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  title="Corregir marcador"
                  className="border-slate-300 bg-white"
                  onClick={() => onCorrect(match)}
                >
                  <Pencil className="size-3 opacity-80" />
                  Corregir
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
