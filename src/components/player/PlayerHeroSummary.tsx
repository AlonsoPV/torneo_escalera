import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { tournamentStatusLabel } from '@/services/playerViewModel'
import type { Tournament } from '@/types/database'

type Props = {
  firstName: string
  tournamentName: string
  groupName: string
  tournament: Tournament
  groupDetailHref: string
  toolbar?: ReactNode
}

export function PlayerHeroSummary({
  firstName,
  tournamentName,
  groupName,
  tournament,
  groupDetailHref,
  toolbar,
}: Props) {
  const stateLabel = tournamentStatusLabel(tournament.status)
  const isPast = tournament.status !== 'active'

  return (
    <section
      id="player-section-hero"
      data-name="player-section-hero"
      className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm sm:rounded-3xl"
    >
      <div className="relative px-4 py-3 sm:px-5 sm:py-4">
        <div className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-[#C8A96B]/14 blur-2xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="border-[#1F5A4C]/25 bg-[#1F5A4C]/8 px-2 py-0.5 text-[11px] text-[#1F5A4C]">
                {stateLabel}
              </Badge>
              <Badge variant="outline" className="border-[#E2E8F0] bg-[#F6F3EE] px-2 py-0.5 text-[11px] font-medium text-[#5c4d2c]">
                {groupName}
              </Badge>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#102A43] sm:text-2xl">Hola, {firstName}</h1>
            <p className="text-sm font-medium leading-snug text-[#1F5A4C]">
              {isPast ? tournamentName : `Torneo: ${tournamentName}`}
            </p>
            <p className="hidden text-xs leading-relaxed text-[#64748B] sm:block sm:text-sm">
              {isPast
                ? 'Estás viendo resultados de este torneo en la vista de jugador.'
                : 'Aquí ves tu grupo, posición y partidos.'}
            </p>
            {toolbar ? <div className="max-w-md pt-1">{toolbar}</div> : null}
          </div>
          <Link
            to={groupDetailHref}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'inline-flex h-8 shrink-0 items-center gap-1 border-[#E2E8F0] bg-white text-[#1F5A4C] hover:bg-[#F6F3EE] sm:h-9',
            )}
          >
            Ver grupo completo
            <ChevronRight className="size-3.5 sm:size-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
