import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { listTournaments } from '@/services/tournaments'

export function TournamentsListPage() {
  const q = useQuery({ queryKey: ['tournaments'], queryFn: listTournaments })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Torneos</h1>
        <p className="text-sm text-muted-foreground">
          Torneos activos o finalizados visibles para tu cuenta.
        </p>
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : q.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>No se pudieron cargar los torneos.</CardDescription>
          </CardHeader>
        </Card>
      ) : (q.data?.length ?? 0) === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin torneos</CardTitle>
            <CardDescription>
              Cuando existan torneos públicos aparecerán aquí.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-2">
          {q.data?.map((t) => (
            <Link key={t.id} to={`/tournaments/${t.id}`}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardHeader className="space-y-1 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <Badge variant="secondary" className="uppercase">
                      {t.status}
                    </Badge>
                  </div>
                  {t.description ? (
                    <CardDescription className="line-clamp-2">{t.description}</CardDescription>
                  ) : null}
                </CardHeader>
                {t.category ? (
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    Categoría: {t.category}
                  </CardContent>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
