import {
  CalendarClock,
  Info,
  ListFilter,
  Trophy,
  User,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AdminMatchHistoryDialog } from '@/components/admin/matches/AdminMatchHistoryDialog'
import { AdminMatchTable } from '@/components/admin/matches/AdminMatchTable'
import { MatchScoreModal } from '@/components/admin/matches/MatchScoreModal'
import {
  activeTournamentIdFromGroups,
  groupFilterOptionsFromRecords,
  groupsForTournamentSelect,
  matchesInFullScope,
  matchesInTournamentGroupScope,
  playerFilterOptionsFromMatches,
  statusFilterOptionsFromMatches,
  tournamentOptionsFromGroups,
} from '@/components/admin/shared/adminMatchFilters'
import type { AdminScopeFilterSelectConfig } from '@/components/admin/shared/AdminMatchScopeFiltersBar'
import { AdminMatchScopeFiltersBar } from '@/components/admin/shared/AdminMatchScopeFiltersBar'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { parseAdminMatchesStatusQueryParam } from '@/lib/adminStaffNotificationLinks'
import {
  filterMatchesByAdminTab,
  isMatchesAdminTabId,
  MATCHES_ADMIN_TAB_ORDER,
  matchesAdminTabCounts,
  sortMatchesForAdminTab,
  type MatchesAdminTabId,
} from '@/lib/match-status'
import {
  confirmResult,
  correctResult,
  getAdminGroups,
  getAdminMatches,
  type AdminMatchRecord,
} from '@/services/admin'
import { adminInvalidateMatchResult, adminValidateDisputedWithoutChanges } from '@/services/matches'
import { getTournamentRules } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { MatchStatus, ScoreSet } from '@/types/database'

const PAGE_SIZE = 50

const ADMIN_MATCHES_QUERY_BASE = {
  refetchOnMount: 'always' as const,
}

function AdminMatchesDirectorySkeleton() {
  return (
    <div
      className="space-y-4 sm:space-y-5"
      aria-busy="true"
      aria-live="polite"
      aria-label="Cargando partidos"
    >
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}

export function AdminMatchesPage() {
  const qc = useQueryClient()
  const actorId = useAuthStore((s) => s.user?.id)
  const [searchParams, setSearchParams] = useSearchParams()

  const [tournamentId, setTournamentId] = useState('all')
  const [groupId, setGroupId] = useState('all')
  const [playerGroupPlayerId, setPlayerGroupPlayerId] = useState('all')
  const [status, setStatus] = useState<MatchStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<MatchesAdminTabId>('all')
  const [page, setPage] = useState(1)

  const [editingResult, setEditingResult] = useState<AdminMatchRecord | null>(null)
  const [historyMatch, setHistoryMatch] = useState<AdminMatchRecord | null>(null)
  const [highlightMatchId, setHighlightMatchId] = useState<string | null>(null)

  const appliedActiveTournamentDefaultRef = useRef(false)

  const matchesQ = useQuery({
    queryKey: ['admin-matches'],
    queryFn: () => getAdminMatches(),
    ...ADMIN_MATCHES_QUERY_BASE,
    refetchInterval: tab === 'disputed' ? 15_000 : false,
    refetchOnWindowFocus: tab === 'disputed',
    staleTime: tab === 'disputed' ? 10_000 : 30_000,
  })
  const groupsQ = useQuery({
    queryKey: ['admin-groups'],
    queryFn: () => getAdminGroups(),
    ...ADMIN_MATCHES_QUERY_BASE,
    staleTime: 30_000,
  })

  const isDirectoryLoading = matchesQ.isPending || groupsQ.isPending
  const isDirectoryRefreshing =
    !isDirectoryLoading && (matchesQ.isFetching || groupsQ.isFetching)
  const rulesForEditor = useQuery({
    queryKey: ['tournament-rules', editingResult?.tournament_id ?? ''],
    queryFn: () => getTournamentRules(editingResult!.tournament_id),
    enabled: Boolean(editingResult?.tournament_id),
  })

  const tournamentOpts = useMemo(() => tournamentOptionsFromGroups(groupsQ.data ?? []), [groupsQ.data])
  const visibleGroups = useMemo(
    () => groupsForTournamentSelect(groupsQ.data ?? [], tournamentId),
    [groupsQ.data, tournamentId],
  )
  const groupOpts = useMemo(() => groupFilterOptionsFromRecords(visibleGroups), [visibleGroups])
  const matchesForPlayerDropdown = useMemo(
    () => matchesInTournamentGroupScope(matchesQ.data ?? [], tournamentId, groupId),
    [matchesQ.data, tournamentId, groupId],
  )
  const playerOpts = useMemo(() => playerFilterOptionsFromMatches(matchesForPlayerDropdown), [matchesForPlayerDropdown])

  const scopedMatches = useMemo(
    () =>
      matchesInFullScope(matchesQ.data ?? [], {
        tournamentId,
        groupId,
        playerGroupPlayerId,
      }),
    [matchesQ.data, tournamentId, groupId, playerGroupPlayerId],
  )
  const statusOpts = useMemo(() => statusFilterOptionsFromMatches(scopedMatches), [scopedMatches])

  const filteredByControls = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scopedMatches.filter((match) => {
      const matchesStatus = status === 'all' || match.status === status
      if (!matchesStatus) return false
      if (!q) return true
      const hay = `${match.playerAName} ${match.playerBName} ${match.groupName} ${match.tournamentName}`.toLowerCase()
      return hay.includes(q)
    })
  }, [scopedMatches, search, status])

  const tabCounts = useMemo(() => matchesAdminTabCounts(filteredByControls), [filteredByControls])

  const tabFilteredSorted = useMemo(() => {
    const bucket = filterMatchesByAdminTab(filteredByControls, tab)
    return sortMatchesForAdminTab(bucket, tab)
  }, [filteredByControls, tab])

  const totalRows = tabFilteredSorted.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pageSlice = useMemo(
    () => tabFilteredSorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [tabFilteredSorted, safePage],
  )

  const resetPage = useCallback(() => {
    setPage(1)
  }, [])

  const applyAdminMatchFilters = useCallback(
    (next: {
      tournament?: string
      group?: string
      status?: MatchStatus | 'all'
      tab?: MatchesAdminTabId
      highlight?: string | null
    }) => {
      resetPage()
      if (next.tournament !== undefined) setTournamentId(next.tournament)
      if (next.group !== undefined) setGroupId(next.group)
      if (next.status !== undefined) setStatus(next.status)
      if (next.tab !== undefined) setTab(next.tab)
      if ('highlight' in next) setHighlightMatchId(next.highlight ?? null)
    },
    [resetPage],
  )

  const refreshMatchQueries = async (opts?: { touchedMatch?: Pick<AdminMatchRecord, 'id' | 'tournament_id'> }) => {
    const invalidations = [
      qc.invalidateQueries({ queryKey: ['admin-disputed-results'], refetchType: 'active' }),
      qc.invalidateQueries({ queryKey: ['admin-matches'], refetchType: 'active' }),
      qc.invalidateQueries({ queryKey: ['admin-results'], refetchType: 'active' }),
      qc.invalidateQueries({ queryKey: ['admin-overview'], refetchType: 'active' }),
      qc.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'playerViewModel',
        refetchType: 'active',
      }),
      qc.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'tournament-dashboard',
        refetchType: 'active',
      }),
    ]
    const tm = opts?.touchedMatch
    if (tm) {
      invalidations.push(
        qc.invalidateQueries({ queryKey: ['matchScoreLogs', tm.id], refetchType: 'active' }),
        qc.invalidateQueries({ queryKey: ['matchScoreEvents', tm.id], refetchType: 'active' }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard', tm.tournament_id], exact: false, refetchType: 'active' }),
      )
    }
    await Promise.all(invalidations)
  }

  const patchMatchInAdminCaches = useCallback(
    (match: AdminMatchRecord) => {
      const patchList = (old: AdminMatchRecord[] | undefined) =>
        old?.map((item) => (item.id === match.id ? { ...item, ...match } : item))

      qc.setQueryData<AdminMatchRecord[]>(['admin-matches'], patchList)
      qc.setQueryData<AdminMatchRecord[]>(['admin-results'], patchList)
      qc.setQueryData<AdminMatchRecord[]>(['admin-disputed-results'], (old) => {
        if (!old) return old
        if (match.status !== 'score_disputed') return old.filter((item) => item.id !== match.id)
        return patchList(old)
      })
    },
    [qc],
  )

  const resultMut = useMutation({
    mutationFn: async (input: { match: AdminMatchRecord; sets: ScoreSet[]; closeAfter: boolean; adminNote: string }) => {
      if (!actorId) throw new Error('No autenticado')
      return correctResult(
        input.match,
        input.sets,
        actorId,
        input.closeAfter,
        input.adminNote,
        rulesForEditor.data ?? null,
      )
    },
    onSuccess: (updatedMatch, variables) => {
      const disputedValidated =
        variables.match.status === 'score_disputed' && variables.closeAfter
      const nextMatch = { ...variables.match, ...updatedMatch }
      patchMatchInAdminCaches(nextMatch)
      toast.success(
        disputedValidated
          ? 'Marcador corregido y validado'
          : variables.closeAfter
            ? 'Resultado confirmado'
            : 'Corrección guardada',
      )
      setEditingResult(null)
      void refreshMatchQueries({ touchedMatch: nextMatch }).catch((error) => {
        console.warn('[admin-matches] background refresh failed after score correction', error)
      })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al editar resultado'),
  })

  const confirmMut = useMutation({
    mutationFn: async (match: AdminMatchRecord) => {
      if (!actorId) throw new Error('No autenticado')
      await confirmResult(match, actorId)
    },
    onSuccess: async (_, match) => {
      toast.success('Resultado validado y cerrado')
      await refreshMatchQueries({ touchedMatch: match })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al validar resultado'),
  })

  const validateDisputedMut = useMutation({
    mutationFn: async (match: AdminMatchRecord) => {
      await adminValidateDisputedWithoutChanges(match)
    },
    onSuccess: async (_, match) => {
      toast.success('Resultado validado sin cambios de marcador')
      await refreshMatchQueries({ touchedMatch: match })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo validar'),
  })

  const invalidateDisputedMut = useMutation({
    mutationFn: async (match: AdminMatchRecord) => {
      await adminInvalidateMatchResult(match)
    },
    onSuccess: async (_, match) => {
      toast.success('Partido invalidado (cancelado)')
      await refreshMatchQueries({ touchedMatch: match })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo invalidar'),
  })

  const setTabAndUrl = (next: MatchesAdminTabId) => {
    resetPage()
    setTab(next)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'all') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )
  }

  useEffect(() => {
    const groups = groupsQ.data
    if (!groups?.length || appliedActiveTournamentDefaultRef.current) return

    const tournament = searchParams.get('tournament')
    const group = searchParams.get('group')
    const statusRaw = searchParams.get('status')
    const matchFocus = searchParams.get('match')
    const tabRaw = searchParams.get('tab')
    const hasUrlFilters = Boolean(tournament ?? group ?? statusRaw ?? matchFocus ?? tabRaw)

    if (hasUrlFilters) {
      appliedActiveTournamentDefaultRef.current = true
      return
    }

    const activeId = activeTournamentIdFromGroups(groups)
    let handle: number | undefined
    if (activeId) {
      handle = window.setTimeout(() => applyAdminMatchFilters({ tournament: activeId }), 0)
    }
    appliedActiveTournamentDefaultRef.current = true
    return () => {
      if (handle !== undefined) window.clearTimeout(handle)
    }
  }, [applyAdminMatchFilters, groupsQ.data, searchParams])

  useEffect(() => {
    const tournament = searchParams.get('tournament')
    const group = searchParams.get('group')
    const statusRaw = searchParams.get('status')
    const matchFocus = searchParams.get('match')
    const tabRaw = searchParams.get('tab')

    const hasDeepLink = Boolean(tournament ?? group ?? statusRaw ?? matchFocus ?? tabRaw)
    const handle = window.setTimeout(() => {
      if (!hasDeepLink) {
        applyAdminMatchFilters({ highlight: null })
        return
      }
      const parsedStatus = parseAdminMatchesStatusQueryParam(statusRaw)
      applyAdminMatchFilters({
        tournament: tournament ?? undefined,
        group: group ?? undefined,
        status: parsedStatus ?? undefined,
        tab: isMatchesAdminTabId(tabRaw) ? tabRaw : parsedStatus === 'score_disputed' ? 'disputed' : undefined,
        highlight: matchFocus,
      })
    }, 0)
    return () => window.clearTimeout(handle)
  }, [applyAdminMatchFilters, searchParams])

  useEffect(() => {
    if (!highlightMatchId) return
    const found = pageSlice.some((m) => m.id === highlightMatchId)
    if (!found) return
    const handle = window.setTimeout(() => {
      document.getElementById(`admin-match-row-${highlightMatchId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 120)
    return () => window.clearTimeout(handle)
  }, [highlightMatchId, pageSlice])

  const matchScopeFilterSelects = useMemo((): AdminScopeFilterSelectConfig[] => {
    return [
      {
        id: 'tournament',
        label: 'Torneo',
        icon: Trophy,
        value: tournamentId,
        valueLabel: tournamentId === 'all' ? 'Todos' : (tournamentOpts.find((t) => t.id === tournamentId)?.name ?? 'Torneo'),
        onValueChange: (value) => {
          resetPage()
          setTournamentId(value ?? 'all')
          setGroupId('all')
          setPlayerGroupPlayerId('all')
        },
        items: [{ value: 'all', label: 'Todos' }, ...tournamentOpts.map((t) => ({ value: t.id, label: t.name }))],
      },
      {
        id: 'group',
        label: 'Grupo',
        icon: ListFilter,
        value: groupId,
        valueLabel: groupId === 'all' ? 'Todos' : (groupOpts.find((o) => o.value === groupId)?.label ?? 'Grupo'),
        onValueChange: (value) => {
          resetPage()
          setGroupId(value ?? 'all')
          setPlayerGroupPlayerId('all')
        },
        items: [{ value: 'all', label: 'Todos' }, ...groupOpts.map((opt) => ({ value: opt.value, label: opt.label }))],
      },
      {
        id: 'player',
        label: 'Jugador',
        icon: User,
        value: playerGroupPlayerId,
        valueLabel:
          playerGroupPlayerId === 'all'
            ? 'Todos'
            : (playerOpts.find((p) => p.value === playerGroupPlayerId)?.label ?? 'Jugador'),
        onValueChange: (value) => {
          resetPage()
          setPlayerGroupPlayerId(value ?? 'all')
        },
        items: [{ value: 'all', label: 'Todos' }, ...playerOpts],
      },
      {
        id: 'status',
        label: 'Estado',
        value: status,
        valueLabel: status === 'all' ? 'Todos' : (statusOpts.find((opt) => opt.value === status)?.label ?? 'Estado'),
        onValueChange: (value) => {
          resetPage()
          setStatus((value ?? 'all') as MatchStatus | 'all')
        },
        items: [{ value: 'all', label: 'Todos' }, ...statusOpts],
      },
    ]
  }, [tournamentId, tournamentOpts, groupId, groupOpts, playerGroupPlayerId, playerOpts, status, statusOpts, resetPage])

  return (
    <div className="space-y-5 sm:space-y-7 md:space-y-9 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <AdminPageHeader
          eyebrow="Administración"
          title="Partidos"
          actions={
            isDirectoryRefreshing ? (
              <span className="text-xs font-medium text-muted-foreground">Actualizando partidos…</span>
            ) : undefined
          }
        />
        <span
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm"
          title="Administra partidos, marcadores, refutaciones y resultados oficiales del torneo."
          aria-label="Administra partidos, marcadores, refutaciones y resultados oficiales del torneo."
        >
          <Info className="size-4" aria-hidden />
        </span>
      </div>

      {matchesQ.isError && matchesQ.data === undefined ? (
        <AdminEmptyState
          id="admin-matches-load-error"
          title="No se pudieron cargar los partidos"
          description={
            matchesQ.error instanceof Error
              ? matchesQ.error.message
              : 'Revisa permisos de administrador o la conexión con Supabase.'
          }
          icon={CalendarClock}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void matchesQ.refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : isDirectoryLoading ? (
        <AdminMatchesDirectorySkeleton />
      ) : (
        <>
      <AdminMatchScopeFiltersBar
        heading="Filtros"
        description="Torneo, grupo, jugador, estado y búsqueda por nombre."
        search={{
          value: search,
          onChange: (value) => {
            resetPage()
            setSearch(value)
          },
          placeholder: 'Buscar por jugador, grupo o torneo…',
          ariaLabel: 'Buscar partidos',
        }}
        selects={matchScopeFilterSelects}
        onClear={() => {
          resetPage()
          setSearch('')
          setTournamentId('all')
          setGroupId('all')
          setPlayerGroupPlayerId('all')
          setStatus('all')
          setHighlightMatchId(null)
          setTabAndUrl('all')
          setSearchParams({}, { replace: true })
        }}
        clearLabel="Limpiar filtros"
      />

      <section className="space-y-3" aria-labelledby="matches-tabs-heading">
        <AdminSectionTitle id="matches-tabs-heading" title="Listado" description="Filtra por pestaña y revisa acciones por fila." />
        <div
          className="flex flex-wrap gap-2 rounded-xl border border-slate-200/90 bg-white/90 p-2 shadow-sm"
          role="tablist"
          aria-label="Vistas de partidos"
        >
          {MATCHES_ADMIN_TAB_ORDER.map((t) => {
            const selected = tab === t.id
            const count = tabCounts[t.id]
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  selected
                    ? 'bg-[#102A43] text-white shadow-sm'
                    : 'bg-white/90 text-slate-700 ring-1 ring-slate-200/90 hover:bg-white',
                )}
                onClick={() => setTabAndUrl(t.id)}
              >
                {t.label}{' '}
                <span className={cn('tabular-nums', selected ? 'text-white/85' : 'text-slate-500')}>({count})</span>
              </button>
            )
          })}
        </div>

        {matchesQ.isError ? (
          <AdminEmptyState
            title="No se pudieron cargar los partidos."
            description={matchesQ.error instanceof Error ? matchesQ.error.message : 'Revisa permisos o conexión.'}
            icon={CalendarClock}
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => void matchesQ.refetch()}>
                Reintentar
              </Button>
            }
          />
        ) : totalRows === 0 ? (
          <AdminEmptyState
            title="No hay partidos con estos filtros."
            description="Cambia la pestaña, el torneo o limpia filtros."
            icon={CalendarClock}
          />
        ) : (
          <AdminMatchTable
            matches={pageSlice}
            highlightMatchId={highlightMatchId}
            page={safePage}
            pageSize={PAGE_SIZE}
            totalRows={totalRows}
            onPageChange={setPage}
            onEditResult={(match) => setEditingResult(match)}
            onValidate={(match) => confirmMut.mutate(match)}
            onValidateDisputedAsIs={(match) => validateDisputedMut.mutate(match)}
            onInvalidate={(match) => {
              if (!window.confirm('¿Invalidar este partido? Pasará a cancelado y saldrá del ranking.')) return
              invalidateDisputedMut.mutate(match)
            }}
            onHistory={(match) => setHistoryMatch(match)}
          />
        )}
      </section>
        </>
      )}

      <MatchScoreModal
        match={editingResult}
        rules={rulesForEditor.data ?? null}
        open={Boolean(editingResult)}
        onOpenChange={(open) => {
          if (!open) setEditingResult(null)
        }}
        onSubmit={(input) => resultMut.mutate(input)}
        submitPending={resultMut.isPending}
      />

      <AdminMatchHistoryDialog
        match={historyMatch}
        open={Boolean(historyMatch)}
        onOpenChange={(open) => {
          if (!open) setHistoryMatch(null)
        }}
      />
    </div>
  )
}
