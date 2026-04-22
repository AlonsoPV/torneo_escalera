import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SimulationGroupMatrix } from '@/components/simulation/SimulationGroupMatrix'
import type { GroupStandingRow, SimMatch, SimPlayer } from '@/types/tournament'

type Props = {
  playerCount: number
  matchCount: number
  players: SimPlayer[]
  matches: SimMatch[]
  standings: GroupStandingRow[]
}

export function ResultsMatrixCard(props: Props) {
  const { playerCount, matchCount, players, matches, standings } = props

  return (
    <Card className="overflow-hidden border-border/60 shadow-md shadow-black/[0.03] dark:shadow-black/20">
      <CardHeader className="space-y-1 border-b border-border/40 bg-muted/20 pb-4">
        <CardTitle className="text-lg font-bold tracking-tight sm:text-xl">Cuadro de resultados</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Matriz round robin · {playerCount} jugadores · {matchCount} partidos en este grupo · la celda
          simétrica muestra el mismo encuentro con marcador espejado
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <SimulationGroupMatrix players={players} matches={matches} standings={standings} />
      </CardContent>
    </Card>
  )
}
