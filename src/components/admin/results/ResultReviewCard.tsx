import { CheckCircle2, History, Pencil } from 'lucide-react'

import { AdminStatusBadge } from '@/components/admin/shared/AdminStatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { AdminMatchRecord } from '@/services/admin'

function formatScore(match: AdminMatchRecord) {
  return match.score_raw?.map((set) => `${set.a}-${set.b}`).join(', ') ?? 'Sin marcador'
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
  return (
    <Card className="border-[#E2E8F0] bg-white shadow-sm">
      <CardContent className="space-y-5 p-5 sm:p-6">
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
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-2xl bg-[#F8FAFC] p-3">
            <p className="text-xs text-[#64748B]">Marcador</p>
            <p className="mt-1 break-words font-mono text-sm font-semibold tracking-tight text-[#102A43]">
              {formatScore(match)}
            </p>
          </div>
          <div className="rounded-2xl bg-[#F8FAFC] p-3">
            <p className="text-xs text-[#64748B]">Registrado / revisión</p>
            <p className="mt-1 break-all font-semibold text-[#102A43]">
              {match.score_submitted_at
                ? `Enviado ${match.score_submitted_at.slice(0, 10)}`
                : match.updated_by ?? '—'}
              {match.opponent_confirmed_at ? (
                <span className="mt-1 block text-xs font-normal text-[#64748B]">
                  Rival: {match.opponent_confirmed_at.slice(0, 10)}
                </span>
              ) : null}
            </p>
          </div>
          <div className="rounded-2xl bg-[#F8FAFC] p-3">
            <p className="text-xs text-[#64748B]">Última actividad</p>
            <p className="mt-1 font-semibold text-[#102A43]">{match.updated_at?.slice(0, 10) ?? '-'}</p>
          </div>
        </div>
        {match.dispute_reason ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-sm text-[#92400E]">
            <p className="text-xs font-semibold uppercase tracking-wide">Disputa</p>
            <p className="mt-1">{match.dispute_reason}</p>
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
          <Button className="w-full justify-center" variant="outline" disabled>
            Marcar como default
          </Button>
          <Button className="w-full justify-center gap-1.5" variant="ghost" disabled>
            <History className="size-4" />
            Historial próximamente
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
