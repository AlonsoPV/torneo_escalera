import { Ban, ChevronDown, History, MoreHorizontal, Pencil, PlusCircle, ShieldCheck } from 'lucide-react'
import { Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  canAdminEditMatch,
  getMatchStatusColor,
  getMatchStatusLabel,
  isDisputedMatch,
  normalizeMatchStatus,
} from '@/lib/match-status'
import { tournamentPathFromIdAndName } from '@/lib/tournamentUrl'
import { cn } from '@/lib/utils'
import type { AdminMatchRecord } from '@/services/admin'
import type { MatchResultType } from '@/types/database'

function tournamentLink(m: AdminMatchRecord) {
  return tournamentPathFromIdAndName(m.tournament_id, m.tournamentName)
}

function formatScore(match: AdminMatchRecord) {
  return match.score_raw?.map((set) => `${set.a}-${set.b}`).join(' · ') ?? '—'
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

function winnerLabel(match: AdminMatchRecord): string {
  if (match.winner_id === match.player_a_id) return match.playerAName
  if (match.winner_id === match.player_b_id) return match.playerBName
  return '—'
}

const RESULT_TYPE_LABELS: Record<MatchResultType, string> = {
  normal: 'Normal',
  default_win_a: 'W.O. A',
  default_win_b: 'W.O. B',
  wo: 'Walkover',
  def: 'Por defecto',
  not_reported: 'Sin reportar',
  retired: 'Retiro',
  pending_score: 'Pendiente marcador',
  double_penalty: 'Doble penalización',
}

function StatusBadge({ match }: { match: AdminMatchRecord }) {
  const n = isDisputedMatch(match) ? 'disputed' : normalizeMatchStatus(match.status)
  return (
    <span
      className={cn(
        'inline-flex max-w-[10rem] truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        getMatchStatusColor(n),
      )}
      title={getMatchStatusLabel(n)}
    >
      {getMatchStatusLabel(n)}
    </span>
  )
}

export function AdminMatchTable({
  matches,
  onEditResult,
  highlightMatchId,
  page,
  pageSize,
  totalRows,
  onPageChange,
  onValidate,
  onValidateDisputedAsIs,
  onInvalidate,
  onHistory,
}: {
  matches: AdminMatchRecord[]
  onEditResult?: (match: AdminMatchRecord) => void
  highlightMatchId?: string | null
  page: number
  pageSize: number
  totalRows: number
  onPageChange: (nextPage: number) => void
  onValidate?: (match: AdminMatchRecord) => void
  onValidateDisputedAsIs?: (match: AdminMatchRecord) => void
  onInvalidate?: (match: AdminMatchRecord) => void
  onHistory?: (match: AdminMatchRecord) => void
}) {
  const navigate = useNavigate()
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const safePage = Math.min(page, totalPages)

  const disputeRow = (match: AdminMatchRecord) =>
    match.status === 'score_disputed' && Boolean(match.dispute_reason || match.disputedByLabel || match.disputed_at)

  const showRegister = (m: AdminMatchRecord) => m.status === 'pending_score' && canAdminEditMatch(m)
  const showValidate =
    (m: AdminMatchRecord) =>
      (m.status === 'player_confirmed' || m.status === 'score_submitted') && onValidate
  const showValidateDisputed = (m: AdminMatchRecord) => m.status === 'score_disputed' && onValidateDisputedAsIs
  const showInvalidate = (m: AdminMatchRecord) =>
    m.status !== 'cancelled' &&
    m.status !== 'pending_score' &&
    m.status !== 'score_disputed' &&
    onInvalidate

  const paginationFooter = (
    <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-600">
        Mostrando{' '}
        <span className="font-semibold tabular-nums text-slate-900">
          {totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalRows)}
        </span>{' '}
        de <span className="font-semibold tabular-nums">{totalRows}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Anterior
        </Button>
        <span className="tabular-nums text-xs text-slate-600">
          {safePage} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <div className="hidden md:block">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/70 bg-muted/35 hover:bg-muted/35">
                  <TableHead className="min-w-[7rem] whitespace-nowrap">Torneo</TableHead>
                  <TableHead className="min-w-[5rem] whitespace-nowrap">Grupo</TableHead>
                  <TableHead className="min-w-[12rem]">Jugadores</TableHead>
                  <TableHead className="min-w-[5rem] whitespace-nowrap">Marcador</TableHead>
                  <TableHead className="min-w-[6rem]">Ganador</TableHead>
                  <TableHead className="min-w-[6rem]">Estado</TableHead>
                  <TableHead className="min-w-[5rem] whitespace-nowrap">Tipo</TableHead>
                  <TableHead className="min-w-[6rem]">Capturó</TableHead>
                  <TableHead className="min-w-[6rem]">Refutó</TableHead>
                  <TableHead className="min-w-[6rem] whitespace-nowrap">Actualización</TableHead>
                  <TableHead className="min-w-[7rem] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => (
                  <Fragment key={match.id}>
                    <TableRow
                      id={`admin-match-row-${match.id}`}
                      className={cn(highlightMatchId === match.id && 'bg-amber-50/95 ring-2 ring-amber-400/70 ring-inset')}
                    >
                      <TableCell className="max-w-[10rem] truncate text-xs font-medium text-slate-800">
                        <Link className="underline-offset-2 hover:underline" to={tournamentLink(match)}>
                          {match.tournamentName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">{match.groupName}</TableCell>
                      <TableCell className="text-xs">
                        <span className="font-semibold text-slate-950">{match.playerAName}</span>
                        <span className="text-slate-400"> vs </span>
                        <span className="font-semibold text-slate-950">{match.playerBName}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold tabular-nums">{formatScore(match)}</TableCell>
                      <TableCell className="max-w-[8rem] truncate text-xs text-slate-800">{winnerLabel(match)}</TableCell>
                      <TableCell>
                        <StatusBadge match={match} />
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-600">
                        {RESULT_TYPE_LABELS[match.result_type] ?? match.result_type}
                      </TableCell>
                      <TableCell className="max-w-[7rem] truncate text-[11px] text-slate-600">
                        {match.scoreSubmittedByLabel ?? '—'}
                      </TableCell>
                      <TableCell className="max-w-[7rem] truncate text-[11px] text-slate-600">
                        {match.disputedByLabel ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[11px] tabular-nums text-slate-600">
                        {formatWhen(match.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className={cn(
                              buttonVariants({ variant: 'outline', size: 'sm' }),
                              'h-8 gap-1 px-2 text-xs',
                            )}
                          >
                            Acciones
                            <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52" sideOffset={4}>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate(tournamentLink(match))}>
                              Ver torneo
                            </DropdownMenuItem>
                            {onHistory ? (
                              <DropdownMenuItem
                                className="cursor-pointer gap-2"
                                onClick={() => onHistory(match)}
                              >
                                <History className="size-3.5 opacity-80" />
                                Ver historial
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            {showRegister(match) && onEditResult ? (
                              <DropdownMenuItem
                                className="cursor-pointer gap-2"
                                onClick={() => onEditResult(match)}
                              >
                                <PlusCircle className="size-3.5 opacity-80" />
                                Registrar marcador
                              </DropdownMenuItem>
                            ) : null}
                            {canAdminEditMatch(match) && onEditResult && !showRegister(match) && match.status !== 'score_disputed' ? (
                              <DropdownMenuItem
                                className="cursor-pointer gap-2"
                                onClick={() => onEditResult(match)}
                              >
                                <Pencil className="size-3.5 opacity-80" />
                                Corregir marcador
                              </DropdownMenuItem>
                            ) : null}
                            {showValidate(match) ? (
                              <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onValidate?.(match)}>
                                <ShieldCheck className="size-3.5 opacity-80" />
                                Validar resultado
                              </DropdownMenuItem>
                            ) : null}
                            {showValidateDisputed(match) ? (
                              <DropdownMenuItem
                                className="cursor-pointer gap-2"
                                onClick={() => onValidateDisputedAsIs?.(match)}
                              >
                                <ShieldCheck className="size-3.5 opacity-80" />
                                Marcar válido (sin cambiar)
                              </DropdownMenuItem>
                            ) : null}
                            {match.status === 'score_disputed' && onEditResult ? (
                              <DropdownMenuItem
                                className="cursor-pointer gap-2 font-medium text-amber-950"
                                onClick={() => onEditResult(match)}
                              >
                                <Pencil className="size-3.5 opacity-80" />
                                Corregir marcador
                              </DropdownMenuItem>
                            ) : null}
                            {showInvalidate(match) ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                                  onClick={() => onInvalidate?.(match)}
                                >
                                  <Ban className="size-3.5 opacity-80" />
                                  Invalidar partido
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {disputeRow(match) ? (
                      <TableRow className="border-amber-200/80 bg-amber-50/60 hover:bg-amber-50/60">
                        <TableCell colSpan={11} className="py-2 text-xs leading-snug text-amber-950">
                          <span className="font-semibold">Refutación:</span>{' '}
                          {match.dispute_reason ? <span>{match.dispute_reason}</span> : <span>Sin motivo textual</span>}
                          {match.disputedByLabel ? (
                            <span className="text-amber-900/90"> · Por {match.disputedByLabel}</span>
                          ) : null}
                          {match.disputed_at ? (
                            <span className="text-amber-800/80"> · {formatWhen(match.disputed_at)}</span>
                          ) : null}
                          {match.admin_notes ? (
                            <span className="mt-1 block text-[11px] text-slate-700">
                              <span className="font-medium text-slate-800">Nota admin:</span> {match.admin_notes}
                            </span>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
          {paginationFooter}
        </div>
      </div>

      <div className="grid gap-3 md:hidden">
        {matches.map((match) => (
          <Card
            key={match.id}
            id={`admin-match-row-${match.id}`}
            className={cn(
              'rounded-2xl border border-slate-200/70 bg-white shadow-sm',
              highlightMatchId === match.id && 'ring-2 ring-amber-400/80',
            )}
          >
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-pretty text-sm font-semibold text-[#102A43]">
                    {match.playerAName} vs {match.playerBName}
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    <Link className="font-medium underline-offset-2 hover:underline" to={tournamentLink(match)}>
                      {match.tournamentName}
                    </Link>
                    {' · '}
                    {match.groupName}
                  </p>
                </div>
                <StatusBadge match={match} />
              </div>
              {disputeRow(match) ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs leading-snug text-amber-950">
                  <span className="font-semibold">Refutación:</span> {match.dispute_reason ?? '—'}
                  {match.disputedByLabel ? ` · ${match.disputedByLabel}` : ''}
                  {match.disputed_at ? ` · ${formatWhen(match.disputed_at)}` : ''}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[11px] text-[#64748B]">Marcador</p>
                  <p className="font-mono font-semibold text-[#102A43]">{formatScore(match)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#64748B]">Ganador</p>
                  <p className="font-medium text-[#102A43]">{winnerLabel(match)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#64748B]">Tipo resultado</p>
                  <p className="font-medium text-[#102A43]">{RESULT_TYPE_LABELS[match.result_type] ?? match.result_type}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#64748B]">Actualización</p>
                  <p className="tabular-nums font-medium text-[#102A43]">{formatWhen(match.updated_at)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] text-[#64748B]">Capturó / Refutó</p>
                  <p className="text-[#102A43]">
                    {match.scoreSubmittedByLabel ?? '—'} · {match.disputedByLabel ?? '—'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={tournamentLink(match)}>
                  Ver torneo
                </Link>
                {onHistory ? (
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => onHistory(match)}>
                    <History className="size-3.5" />
                    Historial
                  </Button>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1')}>
                    <MoreHorizontal className="size-3.5" />
                    Más
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    {showRegister(match) && onEditResult ? (
                      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onEditResult(match)}>
                        <PlusCircle className="size-3.5" />
                        Registrar marcador
                      </DropdownMenuItem>
                    ) : null}
                    {canAdminEditMatch(match) && onEditResult && !showRegister(match) && match.status !== 'score_disputed' ? (
                      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onEditResult(match)}>
                        <Pencil className="size-3.5" />
                        Corregir
                      </DropdownMenuItem>
                    ) : null}
                    {showValidate(match) ? (
                      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onValidate?.(match)}>
                        <ShieldCheck className="size-3.5" />
                        Validar
                      </DropdownMenuItem>
                    ) : null}
                    {showValidateDisputed(match) ? (
                      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onValidateDisputedAsIs?.(match)}>
                        <ShieldCheck className="size-3.5" />
                        Válido sin cambiar
                      </DropdownMenuItem>
                    ) : null}
                    {match.status === 'score_disputed' && onEditResult ? (
                      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onEditResult(match)}>
                        <Pencil className="size-3.5" />
                        Corregir marcador
                      </DropdownMenuItem>
                    ) : null}
                    {showInvalidate(match) ? (
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                        onClick={() => onInvalidate?.(match)}
                      >
                        <Ban className="size-3.5" />
                        Invalidar
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
        <div className="rounded-xl border border-slate-200 bg-white p-3">{paginationFooter}</div>
      </div>
    </>
  )
}
