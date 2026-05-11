import { CheckCircle2, Pencil } from 'lucide-react'

import { AdminStatusBadge } from '@/components/admin/shared/AdminStatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { AdminMatchRecord } from '@/services/admin'

function formatScore(match: AdminMatchRecord) {
  return match.score_raw?.map((set) => `${set.a}-${set.b}`).join(' · ') ?? 'Sin marcador'
}

function shortDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export function ResultReviewCard({
  match,
  onConfirm,
  onCorrect,
}: {
  match: AdminMatchRecord
  onConfirm: (match: AdminMatchRecord) => void
  onCorrect: (match: AdminMatchRecord) => void
}) {
  const canValidateClose = match.status === 'player_confirmed'
  const winnerName =
    match.winner_id === match.player_a_id
      ? match.playerAName
      : match.winner_id === match.player_b_id
        ? match.playerBName
        : '—'
  return (
    <Card className="border-[#E2E8F0]/80 bg-white shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{match.groupName}</p>
            <h3 className="text-balance text-lg font-semibold leading-snug text-[#102A43] sm:text-xl">
              {match.playerAName} <span className="text-[#64748B]">vs</span> {match.playerBName}
            </h3>
            <p className="text-xs text-[#64748B]">{match.tournamentName}</p>
          </div>
          <div className="flex shrink-0 items-start sm:justify-end">
            <AdminStatusBadge status={match.status} className="whitespace-normal text-left leading-snug" />
          </div>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-[#F8FAFC] p-3">
            <p className="text-xs text-[#64748B]">Marcador</p>
            <p className="mt-1 break-words font-mono text-lg font-semibold tracking-tight text-[#102A43]">
              {formatScore(match)}
            </p>
          </div>
          <div className="rounded-2xl bg-[#F8FAFC] p-3">
            <p className="text-xs text-[#64748B]">Ganador</p>
            <p className="mt-1 font-semibold text-[#102A43]">{winnerName}</p>
          </div>
          <div className="rounded-2xl bg-[#F8FAFC] p-3">
            <p className="text-xs text-[#64748B]">Capturado por</p>
            <p className="mt-1 break-all font-semibold text-[#102A43]">{match.score_submitted_by ?? '—'}</p>
            <p className="mt-1 text-xs text-[#64748B]">{shortDate(match.score_submitted_at)}</p>
          </div>
          <div className="rounded-2xl bg-[#F8FAFC] p-3">
            <p className="text-xs text-[#64748B]">Aceptado por</p>
            <p className="mt-1 break-all font-semibold text-[#102A43]">{match.opponent_confirmed_by ?? '—'}</p>
            <p className="mt-1 text-xs text-[#64748B]">{shortDate(match.opponent_confirmed_at)}</p>
          </div>
        </div>
        {match.dispute_reason ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-sm text-[#92400E]">
            <p className="text-xs font-semibold uppercase tracking-wide">Disputa</p>
            <p className="mt-1">{match.dispute_reason}</p>
          </div>
        ) : null}
        {match.admin_notes ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide">Nota admin</p>
            <p className="mt-1">{match.admin_notes}</p>
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            className="w-full justify-center gap-1.5"
            disabled={!canValidateClose}
            title={
              canValidateClose
                ? undefined
                : 'Solo tras aceptación del rival (estado «Aceptado por rival»).'
            }
            onClick={() => onConfirm(match)}
          >
            <CheckCircle2 className="size-4" />
            Validar y cerrar oficialmente
          </Button>
          <Button className="w-full justify-center gap-1.5" variant="outline" onClick={() => onCorrect(match)}>
            <Pencil className="size-4" />
            Corregir marcador
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
