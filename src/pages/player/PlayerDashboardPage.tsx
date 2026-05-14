import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PlayerGroupSection } from '@/components/player/PlayerGroupSection'
import { PlayerHeroSummary } from '@/components/player/PlayerHeroSummary'
import { PlayerMatchesPanel } from '@/components/player/PlayerMatchesPanel'
import { PlayerQuickMetrics } from '@/components/player/PlayerQuickMetrics'
import { PlayerRecoveryEmailBanner } from '@/components/player/PlayerRecoveryEmailBanner'
import { PlayerTournamentMovementCard } from '@/components/player/PlayerTournamentMovementCard'
import { PlayerTournamentSelector } from '@/components/player/PlayerTournamentSelector'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { recoveryEmailComplete } from '@/lib/profileEmail'
import { dashboardPathWithGroupScope } from '@/lib/dashboardUrl'
import { tournamentPathWithGroup } from '@/lib/tournamentUrl'
import { isAdminRole } from '@/lib/permissions'
import { defaultGroupIdFromContexts, listPlayerDashboardContexts } from '@/services/dashboardPlayer'
import { getPlayerViewModelSession } from '@/services/playerViewModel'
import { useAuthStore } from '@/stores/authStore'
import { Shield } from 'lucide-react'

function firstName(fullName: string | null | undefined): string {
  const t = fullName?.trim()
  if (!t) return 'Jugador'
  return t.split(/\s+/)[0] ?? 'Jugador'
}

export function PlayerDashboardPage() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id) ?? null
  const profile = useAuthStore((s) => s.profile)
  const isAdmin = profile ? isAdminRole(profile.role) : false

  const contextsQ = useQuery({
    queryKey: ['playerContexts', userId],
    queryFn: () => (userId ? listPlayerDashboardContexts(userId) : []),
    enabled: Boolean(userId),
  })

  const contexts = contextsQ.data ?? []
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  useEffect(() => {
    if (!contexts.length) return
    setSelectedGroupId((prev) => {
      if (prev && contexts.some((c) => c.group.id === prev)) return prev
      return defaultGroupIdFromContexts(contexts)
    })
  }, [contexts])

  const effectiveGroupId = useMemo(() => {
    if (!contexts.length) return null
    if (selectedGroupId && contexts.some((c) => c.group.id === selectedGroupId)) return selectedGroupId
    return defaultGroupIdFromContexts(contexts)
  }, [contexts, selectedGroupId])

  const viewQ = useQuery({
    queryKey: ['playerViewModel', userId, effectiveGroupId],
    queryFn: () =>
      userId && effectiveGroupId ? getPlayerViewModelSession(userId, effectiveGroupId) : null,
    enabled: Boolean(userId && effectiveGroupId && contexts.length > 0),
  })

  const name0 = useMemo(() => firstName(profile?.full_name), [profile?.full_name])

  if (!userId) {
    return (
      <div id="page-player" data-name="page-player" className="space-y-3 py-2">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  if (contextsQ.isError) {
    return (
      <div
        id="page-player"
        data-name="page-player"
        className="rounded-2xl border border-red-200 bg-red-50/60 px-4 py-6 text-sm text-red-800"
      >
        No se pudo cargar tus torneos.{' '}
        {contextsQ.error instanceof Error ? contextsQ.error.message : ''}
      </div>
    )
  }

  if (contextsQ.isLoading) {
    return (
      <div id="page-player" data-name="page-player" className="space-y-4 py-2 sm:space-y-6">
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

  if (!contexts.length) {
    if (isAdmin) {
      return (
        <div id="page-player" data-name="page-player" className="mx-auto max-w-lg space-y-4 text-center">
          <section
            id="player-section-empty-admin"
            data-name="player-section-empty-admin"
            className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-8"
          >
            <span className="mb-2 inline-flex size-12 items-center justify-center rounded-2xl bg-[#1F5A4C]/10 text-[#1F5A4C]">
              <Shield className="size-6" />
            </span>
            <h2 className="text-lg font-semibold text-[#102A43]">No estás asignado como jugador</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
              Aún no perteneces a ningún grupo de torneo. Puedes seguir organizando desde el panel de
              administración.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                to="/admin"
                className={buttonVariants({ className: 'w-full bg-[#1F5A4C] hover:bg-[#1F5A4C]/90 sm:w-auto' })}
              >
                Ir al panel admin
              </Link>
            </div>
          </section>
        </div>
      )
    }

    return (
      <div id="page-player" data-name="page-player" className="mx-auto max-w-lg space-y-4 text-center">
        <section
          id="player-section-empty-assignment"
          data-name="player-section-empty-assignment"
          className="rounded-2xl border border-dashed border-[#E2E8F0] bg-white p-6 sm:p-8"
        >
          <h2 className="text-lg font-semibold text-[#102A43]">Aún no estás asignado a un grupo</h2>
          <p className="mt-2 text-sm text-[#64748B]">
            Cuando el administrador te asigne, aquí verás tus partidos y resultados.
          </p>
          <Link
            to="/dashboard"
            className={buttonVariants({ className: 'mt-5 inline-flex bg-[#1F5A4C] hover:bg-[#1F5A4C]/90' })}
          >
            Dashboard del torneo
          </Link>
        </section>
      </div>
    )
  }

  if (!effectiveGroupId || viewQ.isLoading) {
    return (
      <div id="page-player" data-name="page-player" className="space-y-4 py-2 sm:space-y-6">
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
      <div
        id="page-player"
        data-name="page-player"
        className="rounded-2xl border border-red-200 bg-red-50/60 px-4 py-6 text-sm text-red-800"
      >
        No se pudo cargar tu panel. {viewQ.error instanceof Error ? viewQ.error.message : ''}
      </div>
    )
  }

  if (!viewQ.data) {
    return (
      <div
        id="page-player"
        data-name="page-player"
        className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-6 text-sm text-amber-900"
      >
        No se pudieron cargar las reglas o el grupo de este torneo. Si el problema continúa, contacta al
        administrador.
      </div>
    )
  }

  const vm = viewQ.data
  const { data, summary, history } = vm
  const t = data.tournament
  const g = data.group
  const r = data.rules
  const membership = data.membership
  const players = data.players
  const groupHubHref = tournamentPathWithGroup(t, g.id)
  const heroVerGrupoDashboardHref = dashboardPathWithGroupScope(t.id, g.id)

  const refreshPlayerDashboard = async () => {
    await qc.invalidateQueries({ queryKey: ['playerContexts', userId] })
    await qc.invalidateQueries({ queryKey: ['playerViewModel', userId] })
    await qc.invalidateQueries({ queryKey: ['tournament-dashboard'] })
    if (t.id && userId) {
      await qc.invalidateQueries({ queryKey: ['playerTournamentMovement', userId, t.id] })
    }
  }

  return (
    <div id="page-player" data-name="page-player" className="space-y-6">
      <PlayerHeroSummary
        firstName={name0}
        tournamentName={t.name}
        groupName={g.name}
        tournament={t}
        groupDetailHref={heroVerGrupoDashboardHref}
        toolbar={
          contexts.length > 1 ? (
            <PlayerTournamentSelector
              contexts={contexts}
              value={effectiveGroupId}
              onChange={setSelectedGroupId}
            />
          ) : undefined
        }
      />

      {profile && !recoveryEmailComplete(profile) ? <PlayerRecoveryEmailBanner /> : null}

      <PlayerQuickMetrics summary={summary} />

      {userId ? <PlayerTournamentMovementCard playerId={userId} tournamentId={t.id} /> : null}

      <PlayerGroupSection
        groupId={g.id}
        groupName={g.name}
        ranking={data.ranking}
        currentUserId={userId}
      />

      <PlayerMatchesPanel
        matches={history}
        players={players}
        myGroupPlayerId={membership.id}
        userId={userId}
        rules={r}
        groupName={g.name}
        groupDetailHref={groupHubHref}
        groupKey={g.id}
        onAfterAction={refreshPlayerDashboard}
      />
    </div>
  )
}
