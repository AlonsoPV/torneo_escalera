import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type MatchCardAccent = 'neutral' | 'pending' | 'success' | 'warning' | 'dispute' | 'muted'

const accentBar: Record<MatchCardAccent, string> = {
  neutral: 'bg-slate-300',
  pending: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  dispute: 'bg-amber-500',
  muted: 'bg-slate-400',
}

const accentBorder: Record<MatchCardAccent, string> = {
  neutral: 'border-slate-200/90',
  pending: 'border-sky-200/90',
  success: 'border-emerald-200/90',
  warning: 'border-amber-200/90',
  dispute: 'border-amber-200/90',
  muted: 'border-slate-200/80',
}

export function MatchCardShell({
  id,
  dataName,
  accent = 'neutral',
  className,
  children,
}: {
  id?: string
  dataName?: string
  accent?: MatchCardAccent
  className?: string
  children: ReactNode
}) {
  return (
    <article
      id={id}
      data-name={dataName}
      className={cn(
        'overflow-hidden rounded-xl border bg-white shadow-sm ring-1 ring-black/[0.03]',
        accentBorder[accent],
        className,
      )}
    >
      <div className={cn('h-1 w-full', accentBar[accent])} aria-hidden />
      <div className="p-4 sm:p-[1.125rem]">{children}</div>
    </article>
  )
}

export function MatchCardHeader({
  eyebrow,
  title,
  badge,
  meta,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  badge?: ReactNode
  meta?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>
        ) : null}
        <h3 className="text-pretty text-base font-semibold leading-snug text-[#102A43] sm:text-[1.05rem]">{title}</h3>
        {meta ? <p className="text-xs leading-relaxed text-slate-500">{meta}</p> : null}
      </div>
      {badge ? <div className="shrink-0">{badge}</div> : null}
    </header>
  )
}

export function MatchCardScoreBlock({
  label,
  score,
  hint,
  className,
}: {
  label: string
  score: ReactNode
  hint?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col justify-center rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 sm:min-w-[9.5rem]',
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-xl font-bold tabular-nums leading-none tracking-tight text-[#102A43] sm:text-2xl">
        {score}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-snug text-slate-600">{hint}</p> : null}
    </div>
  )
}

export function MatchCardBodyGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start', className)}>
      {children}
    </div>
  )
}

export function MatchCardFacts({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={cn('grid gap-2 text-sm', className)}>
      {children}
    </dl>
  )
}

export function MatchCardFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-3">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-right">{label}</dt>
      <dd className="min-w-0 font-medium leading-snug text-slate-700">{value}</dd>
    </div>
  )
}

export function MatchCardMessage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('mt-3 text-sm leading-relaxed text-slate-600', className)}>{children}</p>
  )
}

export function MatchCardCallout({
  title,
  children,
  variant = 'warning',
  className,
}: {
  title?: string
  children: ReactNode
  variant?: 'warning' | 'info'
  className?: string
}) {
  return (
    <div
      className={cn(
        'mt-3 rounded-lg border px-3 py-2.5 text-sm leading-relaxed',
        variant === 'warning'
          ? 'border-amber-200/90 bg-amber-50/90 text-amber-950'
          : 'border-slate-200/90 bg-slate-50/90 text-slate-700',
        className,
      )}
    >
      {title ? <p className="text-[10px] font-semibold uppercase tracking-wide text-inherit opacity-80">{title}</p> : null}
      <div className={title ? 'mt-1' : undefined}>{children}</div>
    </div>
  )
}

export function MatchCardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <footer className={cn('mt-4 flex flex-col gap-2 border-t border-slate-200/80 pt-4 sm:flex-row sm:flex-wrap sm:justify-end', className)}>
      {children}
    </footer>
  )
}

export function StatusPill({ label, toneClass }: { label: string; toneClass: string }) {
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-tight', toneClass)}>
      {label}
    </span>
  )
}

/** Resumen compacto: ganador, perdedor, marcador, refutó, motivo. */
export function MatchOutcomeSummary({
  winner,
  loser,
  score,
  disputedBy,
  disputeReason,
  reasonClamp = true,
  className,
}: {
  winner?: string | null
  loser?: string | null
  score?: string | null
  disputedBy?: string | null
  disputeReason?: string | null
  reasonClamp?: boolean
  className?: string
}) {
  const showDispute = Boolean(disputedBy || disputeReason)
  const rows: { label: string; value: ReactNode }[] = []

  if (winner) rows.push({ label: 'Ganador', value: winner })
  if (loser) rows.push({ label: 'Perdedor', value: loser })
  if (score && score !== '—') rows.push({ label: 'Marcador', value: <span className="font-mono font-bold tabular-nums">{score}</span> })
  if (showDispute && disputedBy) rows.push({ label: 'Refutó', value: disputedBy })
  if (showDispute && disputeReason) {
    rows.push({
      label: 'Motivo',
      value: (
        <span className={cn(reasonClamp && 'line-clamp-2', 'text-pretty')}>{disputeReason}</span>
      ),
    })
  }

  if (rows.length === 0) return null

  return (
    <dl
      className={cn(
        'mt-3 grid gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2.5 text-sm sm:grid-cols-2',
        className,
      )}
    >
      {rows.map((row) => (
        <div key={row.label} className={cn('min-w-0', row.label === 'Motivo' && 'sm:col-span-2')}>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{row.label}</dt>
          <dd className="mt-0.5 font-medium leading-snug text-slate-800">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function MatchCardExpandable({
  id,
  summary,
  details,
  footer,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  toggleOpenLabel = 'Ver más detalle',
  toggleCloseLabel = 'Menos detalle',
}: {
  id?: string
  summary: ReactNode
  details?: ReactNode
  footer?: ReactNode
  defaultExpanded?: boolean
  expanded?: boolean
  onExpandedChange?: (open: boolean) => void
  toggleOpenLabel?: string
  toggleCloseLabel?: string
}) {
  const [internalOpen, setInternalOpen] = useState(defaultExpanded)
  const expanded = expandedProp ?? internalOpen
  const setExpanded = (next: boolean) => {
    if (expandedProp === undefined) setInternalOpen(next)
    onExpandedChange?.(next)
  }
  const hasDetails = details != null

  return (
    <div id={id} className="min-w-0">
      {summary}

      {hasDetails ? (
        <>
          <div className="mt-3 border-t border-slate-200/80 pt-2">
            <button
              type="button"
              aria-expanded={expanded}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-[#1F5A4C] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/25"
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} aria-hidden />
              {expanded ? toggleCloseLabel : toggleOpenLabel}
            </button>
          </div>
          {expanded ? (
            <div className="mt-3 space-y-3 border-t border-slate-200/60 pt-3">{details}</div>
          ) : null}
        </>
      ) : null}

      {footer}
    </div>
  )
}
