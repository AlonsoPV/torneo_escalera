import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { tournamentStatusLabel } from '@/services/playerViewModel'
import type { Tournament } from '@/types/database'

const COLORS = {
  text: 'text-[#102A43]',
  muted: 'text-[#64748B]',
  border: 'border-[#E2E8F0]',
  card: 'bg-white',
  accent: 'text-[#1F5A4C]',
}

type Props = {
  firstName: string
  tournamentName: string
  groupName: string
  tournament: Tournament
  groupDetailHref: string
  /** Controles adicionales bajo el texto (p. ej. selector de torneo). */
  toolbar?: ReactNode
}

export function PlayerHeaderCard({
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
      id="player-section-header"
      data-name="player-section-header"
      className={`overflow-hidden rounded-3xl border ${COLORS.border} ${COLORS.card} shadow-sm`}
    >
      <div className="relative overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-14 -top-16 size-44 rounded-full bg-[#C8A96B]/16 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 right-8 h-20 w-36 rounded-full bg-[#1F5A4C]/8 blur-2xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-[#1F5A4C]/25 bg-[#1F5A4C]/8 px-2.5 text-[#1F5A4C]"
              >
                {stateLabel}
              </Badge>
              <span className="rounded-full bg-[#C8A96B]/14 px-2.5 py-1 text-xs font-semibold text-[#7A5A16]">
                {groupName}
              </span>
            </div>
            <h1 className={`text-2xl font-bold tracking-tight sm:text-3xl ${COLORS.text}`}>
              Hola, {firstName}
            </h1>
            <p className="text-sm font-semibold text-[#1F5A4C]">
              {isPast ? `Consultas resultados de ${tournamentName}` : `Estás compitiendo en ${tournamentName}`}
            </p>
            <p className={`max-w-2xl text-sm leading-relaxed ${COLORS.muted}`}>
              {isPast
                ? 'Historial, métricas y posición corresponden al torneo seleccionado.'
                : 'Revisa tus partidos, registra marcadores y sigue tu posición dentro del grupo.'}
            </p>
            {toolbar ? <div className="pt-2">{toolbar}</div> : null}
          </div>
          <Link
            to={groupDetailHref}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'w-full shrink-0 border-[#E2E8F0] bg-white/80 text-[#1F5A4C] hover:bg-[#F6F3EE] sm:w-fit',
            )}
          >
            Ver grupo completo
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
