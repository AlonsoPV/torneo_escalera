import { Pencil } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  onEditProfile?: () => void
}

export function PlayerHeaderCard({ firstName, tournamentName, groupName, tournament, onEditProfile }: Props) {
  const stateLabel = tournamentStatusLabel(tournament.status)

  return (
    <section
      className={`overflow-hidden rounded-2xl border ${COLORS.border} ${COLORS.card} shadow-sm`}
    >
      <div className="px-5 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className={`text-2xl font-semibold tracking-tight sm:text-3xl ${COLORS.text}`}>
              Hola, {firstName}
            </h1>
            <p className="text-sm font-medium text-[#1F5A4C]">{tournamentName}</p>
            <p className={`text-sm ${COLORS.muted}`}>
              {groupName} <span className="text-[#C8A96B]">·</span> {stateLabel}
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <Badge
              variant="outline"
              className="w-fit border-[#1F5A4C]/30 bg-[#1F5A4C]/8 text-[#1F5A4C]"
            >
              {stateLabel}
            </Badge>
            {onEditProfile ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-[#E2E8F0] sm:w-auto"
                onClick={onEditProfile}
              >
                <Pencil className="size-3.5" />
                Editar perfil
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
