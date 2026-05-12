import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'

import { tournamentMovementShortLabelEs } from '@/lib/tournamentMovementLabels'
import { getTournament } from '@/services/tournaments'
import { fetchLatestTournamentMovementForPlayer } from '@/services/tournamentMovements'

export function PlayerTournamentMovementCard(props: { playerId: string; tournamentId: string }) {
  const q = useQuery({
    queryKey: ['playerTournamentMovement', props.playerId, props.tournamentId],
    queryFn: async () => {
      const mov = await fetchLatestTournamentMovementForPlayer({
        playerId: props.playerId,
        toTournamentId: props.tournamentId,
      })
      if (!mov) return null
      const from = await getTournament(mov.from_tournament_id)
      return { mov, fromName: from?.name ?? 'Torneo anterior' }
    },
    enabled: Boolean(props.playerId && props.tournamentId),
  })

  if (!q.data) return null

  const { mov, fromName } = q.data

  return (
    <section
      id="player-tournament-movement"
      data-name="player-tournament-movement"
      className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 text-sm shadow-sm ring-1 ring-sky-900/[0.04]"
    >
      <div className="flex gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-700" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-[#102A43]">Procedencia en el circuito</p>
          <p className="text-pretty leading-relaxed text-slate-700">
            En el torneo anterior «{fromName}» quedaste en posición {mov.from_position} de tu grupo. En este torneo tu
            situación se registra como: <strong>{tournamentMovementShortLabelEs(mov.movement_type)}</strong>.
          </p>
        </div>
      </div>
    </section>
  )
}
