import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { listTournaments } from '@/services/tournaments'
import { cn } from '@/lib/utils'

function statusStyles(status: string) {
  switch (status) {
    case 'active':
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
    case 'finished':
      return 'border-sky-500/35 bg-sky-500/10 text-sky-950 dark:text-sky-100'
    case 'draft':
    default:
      return 'border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100'
  }
}

export function TournamentsListPage() {
  const q = useQuery({ queryKey: ['tournaments'], queryFn: listTournaments })

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-10">
      <header className="space-y-2 border-b border-border/80 pb-8">
        <div className="flex items-center gap-2 text-primary">
          <Trophy className="size-7 shrink-0" aria-hidden />
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Torneos</h1>
        </div>
        <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Lista de torneos visibles para tu cuenta: borradores que creaste, activos y finalizados
          según las reglas de acceso del club.
        </p>
      </header>

      {q.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : q.isError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">No se pudieron cargar los torneos</CardTitle>
            <CardDescription>
              Revisa la conexión o la configuración de Supabase e inténtalo de nuevo.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (q.data?.length ?? 0) === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Aún no hay torneos</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Cuando un administrador publique un torneo o te dé acceso, aparecerá aquí. Si gestionas
              el club, puedes crear uno desde Administración.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/admin"
              className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ir a administración
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {q.data?.map((t) => (
            <li key={t.id}>
              <Link to={`/tournaments/${t.id}`} className="group block">
                <Card
                  className={cn(
                    'overflow-hidden transition-all duration-200',
                    'border-border/80 hover:border-primary/25 hover:shadow-md',
                  )}
                >
                  <CardHeader className="relative space-y-2 pb-3 sm:pr-12">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-lg font-semibold leading-snug transition-colors group-hover:text-primary sm:text-xl">
                        {t.name}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={cn('shrink-0 uppercase tracking-wide', statusStyles(t.status))}
                      >
                        {t.status}
                      </Badge>
                    </div>
                    {t.description ? (
                      <CardDescription className="line-clamp-2 text-sm leading-relaxed">
                        {t.description}
                      </CardDescription>
                    ) : null}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {t.category ? (
                        <span>
                          Categoría: <span className="font-medium text-foreground">{t.category}</span>
                        </span>
                      ) : null}
                      {t.season ? (
                        <span>
                          Temporada: <span className="font-medium text-foreground">{t.season}</span>
                        </span>
                      ) : null}
                    </div>
                    <ChevronRight
                      className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 sm:right-4"
                      aria-hidden
                    />
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
