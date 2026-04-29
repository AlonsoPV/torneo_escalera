import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, History, Sparkles, Trophy } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { isAdminRole } from '@/lib/permissions'
import { tournamentPath } from '@/lib/tournamentUrl'
import { cn } from '@/lib/utils'
import { listTournaments } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { Tournament } from '@/types/database'

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

function statusLabel(status: Tournament['status']): string {
  if (status === 'active') return 'En curso'
  if (status === 'finished') return 'Finalizado'
  return 'Borrador'
}

function sortCurrent(a: Tournament, b: Tournament): number {
  if (a.status === 'active' && b.status !== 'active') return -1
  if (a.status !== 'active' && b.status === 'active') return 1
  if (a.status === 'draft' && b.status === 'finished') return -1
  if (a.status === 'finished' && b.status === 'draft') return 1
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

function sortPast(a: Tournament, b: Tournament): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

function TournamentCardRow({ t }: { t: Tournament }) {
  return (
    <li>
      <Link to={tournamentPath(t)} className="group block">
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
                className={cn('shrink-0 tracking-wide', statusStyles(t.status))}
              >
                {statusLabel(t.status)}
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
  )
}

function SectionList({
  title,
  icon: Icon,
  items,
  empty,
}: {
  title: string
  icon: LucideIcon
  items: Tournament[]
  empty: string
}) {
  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Icon className="size-4 shrink-0" aria-hidden />
          {title}
        </h2>
        <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
          {empty}
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        {title}
      </h2>
      <ul className="space-y-3">
        {items.map((t) => (
          <TournamentCardRow key={t.id} t={t} />
        ))}
      </ul>
    </section>
  )
}

export function TournamentsListPage() {
  const q = useQuery({ queryKey: ['tournaments'], queryFn: listTournaments })
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  const initialized = useAuthStore((s) => s.initialized)

  const { current, past } = useMemo(() => {
    const all = q.data ?? []
    const c = all.filter((t) => t.status !== 'finished').sort(sortCurrent)
    const p = all.filter((t) => t.status === 'finished').sort(sortPast)
    return { current: c, past: p }
  }, [q.data])

  const isUserAdmin = Boolean(profile && isAdminRole(profile.role))
  const activeOpen = (q.data ?? []).find((t) => t.status === 'active')

  if (!initialized) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 pb-10">
        <div className="space-y-3">
          <Skeleton className="h-10 w-2/3 max-w-sm rounded-md" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (session && !profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 pb-10">
        <Skeleton className="h-10 w-2/3 max-w-sm rounded-md" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 pb-10">
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (q.isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 pb-10">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">No se pudieron cargar los torneos</CardTitle>
            <CardDescription>
              Revisa la conexión o la configuración de Supabase e inténtalo de nuevo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  /** No admin: ir directo al torneo en curso si existe. */
  if (!isUserAdmin && activeOpen) {
    return <Navigate to={tournamentPath(activeOpen)} replace />
  }

  const isEmpty = (q.data?.length ?? 0) === 0

  if (isUserAdmin) {
    return (
      <div className="mx-auto max-w-3xl space-y-10 pb-10">
        <header className="space-y-2 border-b border-border/80 pb-8">
          <div className="flex items-center gap-2 text-primary">
            <Trophy className="size-7 shrink-0" aria-hidden />
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Torneos</h1>
          </div>
          <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Gestion: torneos <span className="font-medium text-foreground">vigentes</span> (activos o en
            borrador) y <span className="font-medium text-foreground">anteriores</span> (finalizados).
          </p>
        </header>

        {isEmpty ? (
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Aún no hay torneos</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Crea uno desde Administración o publica un borrador cuando cierres el ciclo del torneo
                anterior.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/admin/tournaments"
                className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Ir a administración
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            <SectionList
              title="Torneos actuales"
              icon={Sparkles}
              items={current}
              empty="No hay torneos activos ni en borrador."
            />
            <SectionList
              title="Torneos anteriores"
              icon={History}
              items={past}
              empty="Aún no hay torneos marcados como finalizados."
            />
          </div>
        )}
      </div>
    )
  }

  /* Jugador/visitante sin torneo activo: listado mínimo (p. ej. solo historicos) */
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-10">
      <header className="space-y-2 border-b border-border/80 pb-8">
        <div className="flex items-center gap-2 text-primary">
          <Trophy className="size-7 shrink-0" aria-hidden />
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Torneos</h1>
        </div>
        <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          No hay un torneo en curso ahora. Consulta abajo ediciones anteriores si la organización ya
          publicó cierres.
        </p>
      </header>

      {isEmpty ? (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Aún no hay torneos</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Cuando la organización publique un torneo, podrás entrar desde aquí. Tu panel de jugador
              está en “Cuenta”.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <History className="size-4" aria-hidden />
            Ediciones anteriores
          </h2>
          {past.length > 0 ? (
            <ul className="space-y-3">
              {past.map((t) => (
                <TournamentCardRow key={t.id} t={t} />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
              No hay torneos anteriores registrados.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
