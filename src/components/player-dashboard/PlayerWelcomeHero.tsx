import { Sparkles } from 'lucide-react'

import { PLY_COPY } from '@/lib/playerDashboardCopy'
import { cn } from '@/lib/utils'
import type { TournamentStatus } from '@/types/database'

type Props = {
  firstName: string
  /** Si no se pasa, se usa un título genérico de panel. */
  tournamentName?: string
  /** Si no se pasa, no se muestra la fila grupo · estado. */
  groupName?: string
  tournamentStatus?: TournamentStatus
  /** Texto bajo el título; por defecto el copy de bienvenida. */
  subline?: string
  className?: string
}

function statusPill(t: TournamentStatus) {
  switch (t) {
    case 'active':
      return { label: 'En curso', className: 'bg-[var(--tdash-primary)] text-white' }
    case 'finished':
      return { label: 'Finalizado', className: 'bg-[var(--tdash-surface-2)] text-[var(--tdash-muted)] ring-1 ring-[var(--tdash-border)]' }
    default:
      return {
        label: 'Borrador',
        className: 'border border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] text-[var(--tdash-text)]',
      }
  }
}

export function PlayerWelcomeHero(props: Props) {
  const {
    firstName,
    tournamentName = 'Tu panel de jugador',
    groupName,
    tournamentStatus = 'active',
    subline = PLY_COPY.welcomeSub,
    className,
  } = props
  const pill = statusPill(tournamentStatus)
  const showGroupRow = groupName != null && groupName.length > 0

  return (
    <header
      className={cn(
        'overflow-hidden rounded-2xl border border-[var(--tdash-border)] bg-gradient-to-br from-[var(--tdash-surface)] via-[var(--tdash-surface)] to-[#f0f4fa] p-6 shadow-[var(--tdash-shadow-lg)] md:p-8',
        className,
      )}
    >
      <div className="flex min-w-0 gap-4">
        <div
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md md:size-16"
          style={{
            background: 'linear-gradient(135deg, var(--tdash-primary) 0%, var(--tdash-primary-hover) 100%)',
          }}
        >
          <Sparkles className="size-7 md:size-8" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-[var(--tdash-muted)]">
            Hola,{' '}
            <span className="font-semibold text-[var(--tdash-text)]">{firstName}</span>
            <span className="ml-1.5 text-xs font-medium text-[var(--tdash-gold)]">
              — {PLY_COPY.welcomeTagline}
            </span>
          </p>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-[var(--tdash-text)] md:text-3xl">
            {tournamentName}
          </h1>
          {showGroupRow ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-[var(--tdash-text)]">{groupName}</span>
              <span className="text-[var(--tdash-border)]">·</span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide',
                  pill.className,
                )}
              >
                {pill.label}
              </span>
            </div>
          ) : null}
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--tdash-muted)]">
            {subline}
          </p>
        </div>
      </div>
    </header>
  )
}
