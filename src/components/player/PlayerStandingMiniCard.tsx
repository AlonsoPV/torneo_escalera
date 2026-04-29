import { TrendingUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { RankingRow } from '@/utils/ranking'

type Props = {
  you: RankingRow | null
  leader: RankingRow | null
  pointsBehindLeader: number | null
  className?: string
}

export function PlayerStandingMiniCard({ you, leader, pointsBehindLeader, className }: Props) {
  if (!you) return null

  const line =
    pointsBehindLeader != null && pointsBehindLeader > 0
      ? `Estás a ${pointsBehindLeader} ${pointsBehindLeader === 1 ? 'punto' : 'puntos'} del líder${
          leader ? ` (${leader.displayName})` : ''
        }.`
      : leader && leader.userId === you.userId
        ? 'Vas al frente de tu grupo.'
        : 'Racha en juego. Sigue sumando con tus próximos partidos.'

  return (
    <div
      className={cn(
        'rounded-2xl border border-[#C8A96B]/30 bg-gradient-to-br from-white to-[#C8A96B]/8 p-4 sm:p-5',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#C8A96B]/20 text-[#6E5521]">
          <TrendingUp className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#102A43]">Vas en {you.position}° lugar</p>
          <p className="mt-0.5 text-sm leading-relaxed text-[#64748B]">{line}</p>
        </div>
      </div>
    </div>
  )
}
