import { LayoutGrid, ListOrdered, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { PLY_COPY } from '@/lib/playerDashboardCopy'
import { cn } from '@/lib/utils'

type Props = {
  tournamentId: string
  groupId: string
  allowScoreEntry: boolean
  className?: string
}

export function PlayerMarcadorHub(props: Props) {
  const { tournamentId, groupId, allowScoreEntry, className } = props
  const matrixPath = `/tournaments/${tournamentId}?group=${groupId}`

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)]',
        className,
      )}
      aria-labelledby="marcador-hub-title"
    >
      <div className="border-b border-[var(--tdash-border)] bg-gradient-to-br from-[var(--tdash-surface)] to-[var(--tdash-surface-2)] px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tdash-primary)]">
          {PLY_COPY.marcadorHubEyebrow}
        </p>
        <h2
          id="marcador-hub-title"
          className="mt-1 text-lg font-bold tracking-tight text-[var(--tdash-text)] sm:text-xl"
        >
          {PLY_COPY.marcadorHubTitle}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--tdash-muted)]">
          {PLY_COPY.marcadorHubSub}
        </p>
      </div>

      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:p-5">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-2">
          <Link
            to={matrixPath}
            className={buttonVariants({
              variant: 'default',
              size: 'lg',
              className: 'h-11 w-full gap-2 sm:h-10 sm:w-auto sm:min-w-[12rem]',
            })}
          >
            <LayoutGrid className="size-4 shrink-0" aria-hidden />
            {PLY_COPY.marcadorHubCtaMatrix}
          </Link>
          <a
            href="#panel-partidos-marcador"
            className={buttonVariants({
              variant: 'outline',
              size: 'lg',
              className: 'h-11 w-full gap-2 sm:h-10 sm:w-auto',
            })}
          >
            <ListOrdered className="size-4 shrink-0" aria-hidden />
            {PLY_COPY.marcadorHubCtaPartidos}
          </a>
          <a
            href="#panel-resultados-marcador"
            className={buttonVariants({
              variant: 'outline',
              size: 'lg',
              className: 'h-11 w-full gap-2 sm:h-10 sm:w-auto',
            })}
          >
            <Trophy className="size-4 shrink-0" aria-hidden />
            {PLY_COPY.marcadorHubCtaResultados}
          </a>
        </div>
      </div>

      {!allowScoreEntry ? (
        <p className="border-t border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]/40 px-4 py-3 text-xs text-[var(--tdash-muted)] sm:px-5">
          {PLY_COPY.marcadorHubDisabled}
        </p>
      ) : null}
    </section>
  )
}
