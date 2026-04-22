import { cn } from '@/lib/utils'

import { StatusBadge } from '@/components/simulation/StatusBadge'
import type { MatrixCellKind } from '@/components/simulation/matrixCellState'

type Props = {
  kind: MatrixCellKind
  label: string
  title?: string
  matchType?: 'normal' | 'default' | null
}

const kindStyles: Record<Exclude<MatrixCellKind, 'diagonal'>, string> = {
  empty:
    'border-dashed border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] text-[var(--tdash-muted)]',
  win: 'border border-[var(--tdash-win-border)] bg-[var(--tdash-win-bg)] text-[var(--tdash-win-text)] shadow-sm',
  loss: 'border border-[var(--tdash-loss-border)] bg-[var(--tdash-loss-bg)] text-[var(--tdash-loss-text)] shadow-sm',
  'default-win':
    'border border-[var(--tdash-def-border)] bg-[var(--tdash-def-bg)] text-[var(--tdash-def-text)] shadow-sm',
  'default-loss':
    'border border-[var(--tdash-def-border)] bg-[var(--tdash-def-bg)]/80 text-[var(--tdash-def-text)] shadow-sm',
}

export function ScoreCell(props: Props) {
  const { kind, label, title, matchType } = props

  if (kind === 'diagonal') {
    return (
      <div
        className="flex h-[3.35rem] w-full items-center justify-center rounded-xl border border-[var(--tdash-border)] bg-[linear-gradient(135deg,var(--tdash-block)_0px,var(--tdash-block)_5px,transparent_5px,transparent_10px)]"
        style={{
          backgroundColor: 'var(--tdash-block)',
          backgroundImage: `repeating-linear-gradient(135deg, var(--tdash-block-2) 0px, var(--tdash-block-2) 3px, transparent 3px, transparent 6px)`,
        }}
        aria-hidden
      >
        <span className="text-[10px] font-semibold text-[var(--tdash-muted)]">—</span>
      </div>
    )
  }

  const style = kindStyles[kind]

  const inner = (
    <>
      <span className="w-full font-mono text-[11px] font-semibold leading-tight tracking-tight text-current sm:text-xs">
        {label}
      </span>
      {matchType === 'default' ? (
        <StatusBadge variant="default">DEF</StatusBadge>
      ) : null}
    </>
  )

  const baseClass = cn(
    'group flex h-[3.35rem] w-[4.75rem] max-w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-center transition-[transform,box-shadow] duration-200 sm:w-[5.25rem]',
    style,
  )

  if (kind === 'empty') {
    return (
      <div title={title ?? undefined} className={cn(baseClass, 'cursor-default')}>
        {inner}
      </div>
    )
  }

  return (
    <button
      type="button"
      title={title ?? undefined}
      className={cn(
        baseClass,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tdash-primary)]/30',
        'hover:brightness-[1.02] active:scale-[0.98]',
      )}
    >
      {inner}
    </button>
  )
}
