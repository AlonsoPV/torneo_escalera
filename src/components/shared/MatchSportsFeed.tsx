import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Crown,
  History,
  Pencil,
  XCircle,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { MatchStatus } from '@/types/database'
import type { ScoreSet } from '@/types/database'

export type MatchFeedVisualState =
  | 'disputed'
  | 'refuted_pending'
  | 'pending_rival'
  | 'official'
  | 'validated'
  | 'scheduled'
  | 'cancelled'
  | 'neutral'

const feedStateStyles: Record<
  MatchFeedVisualState,
  { bar: string; border: string; banner: string; icon: typeof AlertTriangle; title: string; subtitle: string }
> = {
  disputed: {
    bar: 'bg-amber-500',
    border: 'border-amber-200/90',
    banner: 'border-amber-200 bg-amber-50 text-amber-950',
    icon: AlertTriangle,
    title: 'Disputado',
    subtitle: 'Esperando revisión admin',
  },
  refuted_pending: {
    bar: 'bg-amber-500',
    border: 'border-amber-200/90',
    banner: 'border-amber-200 bg-amber-50 text-amber-950',
    icon: AlertTriangle,
    title: 'Refutado',
    subtitle: 'Pendiente de nuevo marcador',
  },
  pending_rival: {
    bar: 'bg-sky-500',
    border: 'border-sky-200/90',
    banner: 'border-sky-200 bg-sky-50 text-sky-950',
    icon: Clock,
    title: 'Pendiente',
    subtitle: 'Esperando confirmación del rival',
  },
  official: {
    bar: 'bg-emerald-500',
    border: 'border-emerald-200/90',
    banner: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    icon: CheckCircle2,
    title: 'Oficial',
    subtitle: 'Resultado confirmado por jugadores',
  },
  validated: {
    bar: 'bg-emerald-500',
    border: 'border-emerald-200/90',
    banner: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    icon: CheckCircle2,
    title: 'Validado',
    subtitle: 'Confirmado por administración',
  },
  scheduled: {
    bar: 'bg-slate-400',
    border: 'border-slate-200/90',
    banner: 'border-slate-200 bg-slate-50 text-slate-700',
    icon: Clock,
    title: 'Programado',
    subtitle: 'Sin marcador registrado',
  },
  cancelled: {
    bar: 'bg-red-500',
    border: 'border-red-200/90',
    banner: 'border-red-200 bg-red-50 text-red-950',
    icon: Ban,
    title: 'Cancelado',
    subtitle: 'Partido no disputado',
  },
  neutral: {
    bar: 'bg-slate-300',
    border: 'border-slate-200/90',
    banner: 'border-slate-200 bg-slate-50 text-slate-700',
    icon: Clock,
    title: 'En seguimiento',
    subtitle: '',
  },
}

export function resolveMatchFeedVisualState(
  status: MatchStatus,
  refutedPending: boolean,
): MatchFeedVisualState {
  if (refutedPending) return 'refuted_pending'
  switch (status) {
    case 'score_disputed':
      return 'disputed'
    case 'score_submitted':
      return 'pending_rival'
    case 'closed':
      return 'official'
    case 'validated':
      return 'validated'
    case 'pending_score':
      return 'scheduled'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'neutral'
  }
}

export function MatchFeedCard({
  id,
  dataName,
  visualState,
  className,
  children,
}: {
  id?: string
  dataName?: string
  visualState: MatchFeedVisualState
  className?: string
  children: ReactNode
}) {
  const styles = feedStateStyles[visualState]
  return (
    <article
      id={id}
      data-name={dataName}
      className={cn(
        'overflow-hidden rounded-xl border bg-white shadow-sm ring-1 ring-black/[0.03]',
        styles.border,
        className,
      )}
    >
      <div className={cn('h-0.5 w-full', styles.bar)} aria-hidden />
      <div className="space-y-2.5 p-3">{children}</div>
    </article>
  )
}

export function MatchFeedStatusBanner({ visualState }: { visualState: MatchFeedVisualState }) {
  const styles = feedStateStyles[visualState]
  const Icon = styles.icon
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5', styles.banner)}>
      <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase leading-tight tracking-wide">{styles.title}</p>
        {styles.subtitle ? (
          <p className="text-[10px] leading-snug opacity-85">{styles.subtitle}</p>
        ) : null}
      </div>
    </div>
  )
}

export function formatCompactMatchScore(sets: ScoreSet[] | null | undefined): string | null {
  if (!sets?.length) return null
  return sets.map((s) => `${s.a}-${s.b}`).join(' · ')
}

/** Marcador compacto con games del ganador primero en cada set (6-4 · 6-3). */
export function formatCompactMatchScoreFromWinnerPerspective(
  sets: ScoreSet[] | null | undefined,
  winnerId: string | null,
  _playerAId: string,
  playerBId: string,
): string | null {
  if (!sets?.length) return null
  const winnerIsB = winnerId === playerBId
  return sets.map((set) => (winnerIsB ? `${set.b}-${set.a}` : `${set.a}-${set.b}`)).join(' · ')
}

export function resolveFeedWinnerName(
  winnerId: string | null,
  playerAId: string,
  playerBId: string,
  playerAName: string,
  playerBName: string,
): string | null {
  if (winnerId === playerAId) return playerAName
  if (winnerId === playerBId) return playerBName
  return null
}

export function MatchFeedCompactHeader({
  groupName,
  tournamentName,
  playerAName,
  playerBName,
  playerANameContent,
  playerBNameContent,
  dateLabel,
  scoreLabel,
  winnerName,
}: {
  groupName: string
  tournamentName: string
  playerAName: string
  playerBName: string
  playerANameContent?: ReactNode
  playerBNameContent?: ReactNode
  dateLabel?: string | null
  scoreLabel?: string | null
  winnerName?: string | null
}) {
  return (
    <header className="space-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight text-[#102A43]">{groupName}</p>
        <span className="max-w-[45%] truncate text-[10px] leading-tight text-slate-400" title={tournamentName}>
          {tournamentName}
        </span>
      </div>
      <h3 className="text-pretty text-[15px] font-bold leading-snug tracking-tight text-[#102A43]">
        {playerANameContent ?? playerAName}
        <span className="mx-1.5 font-normal text-slate-400">vs</span>
        {playerBNameContent ?? playerBName}
      </h3>
      {scoreLabel || winnerName ? (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-snug text-slate-600">
          {scoreLabel ? (
            <span className="font-mono text-sm font-bold tabular-nums text-[#102A43]">{scoreLabel}</span>
          ) : (
            <span className="text-slate-400">Sin marcador</span>
          )}
          {winnerName ? (
            <>
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <span className="inline-flex items-center gap-1">
                <Crown className="size-3 shrink-0 text-emerald-600" aria-hidden />
                <span>
                  Ganó <span className="font-semibold text-emerald-800">{winnerName}</span>
                </span>
              </span>
            </>
          ) : null}
        </p>
      ) : null}
      {dateLabel ? <p className="text-[10px] text-slate-400">{dateLabel}</p> : null}
    </header>
  )
}

export function MatchFeedScoreboard({
  playerAName,
  playerBName,
  sets,
  winnerId,
  playerAId,
  playerBId,
  className,
}: {
  playerAName: string
  playerBName: string
  sets: ScoreSet[] | null | undefined
  winnerId: string | null
  playerAId: string
  playerBId: string
  className?: string
}) {
  const winnerIsA = winnerId === playerAId
  const winnerIsB = winnerId === playerBId
  const scoreSets = sets ?? []

  if (scoreSets.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-center text-xs text-slate-500',
          className,
        )}
      >
        Sin marcador registrado
      </div>
    )
  }

  const renderRow = (name: string, games: number[], isWinner: boolean) => (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5',
        isWinner && 'border border-emerald-200/90 bg-emerald-50/70',
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {isWinner ? <Crown className="size-3.5 shrink-0 text-emerald-600" aria-hidden /> : null}
        <span
          className={cn(
            'truncate text-sm leading-tight',
            isWinner ? 'font-bold text-emerald-900' : 'font-medium text-slate-700',
          )}
        >
          {name}
        </span>
      </div>
      <div className="flex items-center gap-1 font-mono text-sm font-bold tabular-nums leading-none text-[#102A43]">
        {games.map((g, i) => (
          <span key={i} className="inline-flex items-center">
            {i > 0 ? <span className="mx-0.5 text-slate-300">·</span> : null}
            {g}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div className={cn('space-y-1 rounded-lg border border-slate-200/80 bg-slate-50/50 p-1.5', className)}>
      {renderRow(
        playerAName,
        scoreSets.map((s) => s.a),
        winnerIsA,
      )}
      {renderRow(
        playerBName,
        scoreSets.map((s) => s.b),
        winnerIsB,
      )}
    </div>
  )
}

export type MatchFeedTimelineStep = {
  kind: 'success' | 'warning' | 'pending' | 'info' | 'error'
  text: string
}

const timelineIcon: Record<MatchFeedTimelineStep['kind'], typeof Check> = {
  success: Check,
  warning: AlertTriangle,
  pending: Clock,
  info: CheckCircle2,
  error: XCircle,
}

const timelineTone: Record<MatchFeedTimelineStep['kind'], string> = {
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  pending: 'text-sky-600',
  info: 'text-slate-500',
  error: 'text-red-600',
}

export function MatchFeedWorkflowTimeline({
  steps,
  className,
  collapsible = true,
  defaultCollapsed = true,
}: {
  steps: MatchFeedTimelineStep[]
  className?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
}) {
  const [open, setOpen] = useState(!defaultCollapsed)

  if (steps.length === 0) return null

  const list = (
    <ul className="space-y-1">
      {steps.map((step, i) => {
        const Icon = timelineIcon[step.kind]
        return (
          <li key={i} className="flex items-start gap-2 text-xs leading-snug text-slate-700">
            <Icon className={cn('mt-0.5 size-3.5 shrink-0', timelineTone[step.kind])} aria-hidden />
            <span className="min-w-0 text-pretty">{step.text}</span>
          </li>
        )
      })}
    </ul>
  )

  if (!collapsible) {
    return <div className={className}>{list}</div>
  }

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center gap-1 rounded-md py-1 text-left text-[11px] font-medium text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/25"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        {open ? 'Ocultar historial' : 'Ver historial'}
      </button>
      {open ? <div className="mt-1">{list}</div> : null}
    </div>
  )
}

export function MatchFeedActionBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <footer className={cn('flex flex-col gap-2 border-t border-slate-100 pt-2.5 sm:flex-row sm:items-center sm:justify-between', className)}>
      {children}
    </footer>
  )
}

export type MatchFeedLogEntry = {
  label: string
  value: ReactNode
  multiline?: boolean
}

export function MatchFeedLogDialog({
  open,
  onOpenChange,
  title = 'Registro administrativo',
  entries,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  entries: MatchFeedLogEntry[]
  children?: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Historial y datos de auditoría del partido.</DialogDescription>
        </DialogHeader>
        <dl className="space-y-2.5 text-sm">
          {entries.map((entry) => (
            <div key={entry.label} className="grid gap-0.5">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{entry.label}</dt>
              <dd
                className={cn(
                  'font-medium leading-relaxed text-slate-800',
                  entry.multiline && 'whitespace-pre-wrap text-pretty',
                )}
              >
                {entry.value}
              </dd>
            </div>
          ))}
        </dl>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export function MatchFeedLogButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('h-8 px-2 text-xs text-slate-500 hover:text-slate-800', className)}
      onClick={onClick}
    >
      <History className="size-3.5 opacity-70" />
      Ver log
    </Button>
  )
}

export function MatchFeedValidateButton({
  id,
  name,
  pending,
  disabled,
  onClick,
}: {
  id?: string
  name?: string
  pending?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      id={id}
      name={name}
      size="sm"
      className="h-9 bg-emerald-600 text-white hover:bg-emerald-700"
      onClick={onClick}
      disabled={disabled || pending}
    >
      <CheckCircle2 className="size-3.5 opacity-90" />
      {pending ? 'Validando…' : 'Validar resultado'}
    </Button>
  )
}

export function MatchFeedEditButton({
  id,
  name,
  disabled,
  onClick,
}: {
  id?: string
  name?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button id={id} name={name} size="sm" variant="outline" className="h-9" onClick={onClick} disabled={disabled}>
      <Pencil className="size-3.5 opacity-80" />
      Editar
    </Button>
  )
}

export function MatchFeedWaitingLabel({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-slate-500">
      <Clock className="size-3.5 shrink-0 opacity-70" aria-hidden />
      {children}
    </p>
  )
}

export function useMatchFeedLogDialog() {
  const [open, setOpen] = useState(false)
  return { logOpen: open, setLogOpen: setOpen }
}

export function shortFeedDate(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(d)
}
