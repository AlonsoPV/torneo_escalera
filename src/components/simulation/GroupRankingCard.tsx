import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SimulationGroupRanking } from '@/components/simulation/SimulationGroupRanking'
import type { GroupStandingRow } from '@/types/tournament'

type Props = {
  rows: GroupStandingRow[]
}

export function GroupRankingCard(props: Props) {
  const { rows } = props

  return (
    <Card className="border-border/60 shadow-md shadow-black/[0.03] dark:shadow-black/20">
      <CardHeader className="border-b border-border/40 bg-muted/15 pb-4">
        <CardTitle className="text-lg font-bold tracking-tight sm:text-xl">Ranking del grupo</CardTitle>
        <CardDescription>
          Orden: puntos → victorias → diferencia de sets → diferencia de games. En móvil, toca una fila
          para ver el detalle.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <SimulationGroupRanking rows={rows} />
      </CardContent>
    </Card>
  )
}
