import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { MatchHistoryCard } from '@/components/player/MatchHistoryCard'
import { NextMatchesCard } from '@/components/player/NextMatchesCard'
import { PlayerGroupCard } from '@/components/player/PlayerGroupCard'
import { PlayerHeaderCard } from '@/components/player/PlayerHeaderCard'
import { PlayerStandingMiniCard } from '@/components/player/PlayerStandingMiniCard'
import { PlayerSummaryCards } from '@/components/player/PlayerSummaryCards'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { tournamentPathWithGroup } from '@/lib/tournamentUrl'
import { isAdminRole } from '@/lib/permissions'
import { getPlayerViewModelSession } from '@/services/playerViewModel'
import { useAuthStore } from '@/stores/authStore'
import { HelpCircle, Shield } from 'lucide-react'

function firstName(fullName: string | null | undefined): string {
  const t = fullName?.trim()
  if (!t) return 'Jugador'
  return t.split(/\s+/)[0] ?? 'Jugador'
}

export function PlayerDashboardPage() {
  const userId = useAuthStore((s) => s.user?.id) ?? null
  const profile = useAuthStore((s) => s.profile)
  const isAdmin = profile ? isAdminRole(profile.role) : false

  const viewQ = useQuery({
    queryKey: ['playerViewModel', userId],
    queryFn: () => (userId ? getPlayerViewModelSession(userId) : null),
    enabled: Boolean(userId),
  })

  const name0 = useMemo(() => firstName(profile?.full_name), [profile?.full_name])

  if (!userId) {
    return (
      <div className="space-y-3 py-2">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  if (viewQ.isLoading) {
    return (
      <div className="space-y-4 py-2 sm:space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    )
  }

  if (viewQ.isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/60 px-4 py-6 text-sm text-red-800">
        No se pudo cargar tu panel. {viewQ.error instanceof Error ? viewQ.error.message : ''}
      </div>
    )
  }

  if (!viewQ.data) {
    if (isAdmin) {
      return (
        <div className="mx-auto max-w-lg space-y-4 text-center">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-8">
            <span className="mb-2 inline-flex size-12 items-center justify-center rounded-2xl bg-[#1F5A4C]/10 text-[#1F5A4C]">
              <Shield className="size-6" />
            </span>
            <h2 className="text-lg font-semibold text-[#102A43]">No estás asignado como jugador</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
              Aún no perteneces a ningún grupo con un torneo activo. Puedes seguir organizando el torneo desde
              el panel de administración.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                to="/admin"
                className={buttonVariants({ className: 'w-full bg-[#1F5A4C] hover:bg-[#1F5A4C]/90 sm:w-auto' })}
              >
                Ir al panel admin
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <div className="rounded-2xl border border-dashed border-[#E2E8F0] bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-[#102A43]">Aún no estás asignado a un grupo</h2>
          <p className="mt-2 text-sm text-[#64748B]">
            Cuando el administrador te asigne, aquí verás tus juegos, calendario y resultados.
          </p>
          <Link
            to="/tournaments"
            className={buttonVariants({ className: 'mt-5 inline-flex bg-[#1F5A4C] hover:bg-[#1F5A4C]/90' })}
          >
            Ver torneos
          </Link>
        </div>
      </div>
    )
  }

  const vm = viewQ.data
  const { data, summary, upcoming, history, myStanding, leader, pointsBehindLeader } = vm
  const t = data.tournament
  const g = data.group
  const r = data.rules
  const membership = data.membership
  const players = data.players
  const groupHubHref = tournamentPathWithGroup(t, g.id)

  return (
    <div className="space-y-4 sm:space-y-6">
      <PlayerHeaderCard
        firstName={name0}
        tournamentName={t.name}
        groupName={g.name}
        tournament={t}
        onEditProfile={() => toast.info('Edición de perfil disponible pronto.')}
      />

      <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 xl:grid-cols-12">
        <div className="order-2 space-y-4 sm:space-y-6 xl:order-1 xl:col-span-7">
          <NextMatchesCard
            matches={upcoming}
            players={players}
            myGroupPlayerId={membership.id}
            userId={userId}
            tournamentId={t.id}
            tournamentName={t.name}
            groupId={g.id}
            groupName={g.name}
            rules={r}
          />
          <MatchHistoryCard
            matches={history}
            players={players}
            myGroupPlayerId={membership.id}
            userId={userId}
            rules={r}
            seeAllHref={groupHubHref}
          />
        </div>

        <div className="order-1 space-y-4 sm:space-y-6 xl:order-2 xl:col-span-5">
          <PlayerSummaryCards summary={summary} />
          <PlayerGroupCard
            groupName={g.name}
            players={players}
            ranking={data.ranking}
            currentUserId={userId}
            groupDetailHref={groupHubHref}
          />
          <PlayerStandingMiniCard
            you={myStanding}
            leader={leader}
            pointsBehindLeader={pointsBehindLeader}
          />
        </div>
      </div>

      <footer className="border-t border-[#E2E8F0] pt-4 text-center">
        <div className="flex flex-col flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:flex-row">
          <Link
            to={groupHubHref}
            className="text-sm font-medium text-[#64748B] underline-offset-2 hover:text-[#1F5A4C] hover:underline"
          >
            Ver grupo completo
          </Link>
          <span className="hidden text-[#C8A96B] sm:inline" aria-hidden>
            ·
          </span>
          <Link
            to={groupHubHref}
            className="text-sm font-medium text-[#64748B] underline-offset-2 hover:text-[#1F5A4C] hover:underline"
          >
            Ver todos mis resultados
          </Link>
          <span className="hidden text-[#C8A96B] sm:inline" aria-hidden>
            ·
          </span>
          <button
            type="button"
            className="text-sm font-medium text-[#64748B] underline-offset-2 hover:text-[#1F5A4C] hover:underline"
            onClick={() => toast.info('Reglas: consulta a la organización.')}
          >
            <span className="inline-flex items-center gap-1">
              <HelpCircle className="size-3.5" />
              Ayuda / reglas
            </span>
          </button>
        </div>
      </footer>
    </div>
  )
}
