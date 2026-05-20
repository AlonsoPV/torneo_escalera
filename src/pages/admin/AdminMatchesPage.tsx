import {
  CalendarClock,
  Download,
  ListFilter,
  Trophy,
  Upload,
  User,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
  playerOptionsFromMatches,
  tournamentOptionsFromGroups,
} from '@/components/admin/shared/adminMatchFilters'
import type { AdminScopeFilterSelectConfig } from '@/components/admin/shared/AdminMatchScopeFiltersBar'
import { AdminMatchScopeFiltersBar } from '@/components/admin/shared/AdminMatchScopeFiltersBar'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { Button, buttonVariants } from '@/components/ui/button'
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

const STATUS_FILTER_ALLOWED: MatchStatus[] = ['player_confirmed', 'score_submitted', 'score_disputed']

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

  useEffect(() => {
    if (status !== 'all' && !STATUS_FILTER_ALLOWED.includes(status)) {
      setStatus('all')
    }
  }, [status])

  const matchesQ = useQuery({ queryKey: ['admin-matches'], queryFn: () => getAdminMatches() })
  const groupsQ = useQuery({ queryKey: ['admin-groups'], queryFn: () => getAdminGroups() })
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
  const playerOpts = useMemo(() => playerOptionsFromMatches(matchesForPlayerDropdown), [matchesForPlayerDropdown])

  const scopedMatches = useMemo(
    () =>
      matchesInFullScope(matchesQ.data ?? [], {
        tournamentId,
        groupId,
        playerGroupPlayerId,
      }),
    [matchesQ.data, tournamentId, groupId, playerGroupPlayerId],
  )

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

  useEffect(() => {
    setPage(1)
  }, [tournamentId, groupId, playerGroupPlayerId, status, search, tab])

  const refreshMatchQueries = async (opts?: { touchedMatch?: Pick<AdminMatchRecord, 'id' | 'tournament_id'> }) => {
    await qc.invalidateQueries({ queryKey: ['admin-matches'] })
    await qc.invalidateQueries({ queryKey: ['admin-results'] })
    await qc.invalidateQueries({ queryKey: ['admin-overview'] })
    await qc.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'playerViewModel',
    })
    await qc.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'tournament-dashboard',
    })
    const tm = opts?.touchedMatch
    if (tm) {
      await qc.invalidateQueries({ queryKey: ['matchScoreLogs', tm.id] })
      await qc.invalidateQueries({ queryKey: ['matchScoreEvents', tm.id] })
      await qc.invalidateQueries({ queryKey: ['tournament-dashboard', tm.tournament_id], exact: false })
    }
  }

  const resultMut = useMutation({
    mutationFn: async (input: { match: AdminMatchRecord; sets: ScoreSet[]; closeAfter: boolean; adminNote: string }) => {
      if (!actorId) throw new Error('No autenticado')
      await correctResult(input.match, input.sets, actorId, input.closeAfter, input.adminNote)
    },
    onSuccess: async (_data, variables) => {
      const draftDisputed =
        variables.match.status === 'score_disputed' && variables.closeAfter === false
      toast.success(
        draftDisputed
          ? 'Corrección guardada (sigue en revisión)'
          : variables.closeAfter
            ? 'Resultado confirmado'
            : 'Corrección guardada',
      )
      setEditingResult(null)
      await refreshMatchQueries({ touchedMatch: variables.match })
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
    if (activeId) {
      setTournamentId(activeId)
    }
    appliedActiveTournamentDefaultRef.current = true
  }, [groupsQ.data, searchParams])

  useEffect(() => {
    const tournament = searchParams.get('tournament')
    const group = searchParams.get('group')
    const statusRaw = searchParams.get('status')
    const matchFocus = searchParams.get('match')
    const tabRaw = searchParams.get('tab')

    const hasDeepLink = Boolean(tournament ?? group ?? statusRaw ?? matchFocus ?? tabRaw)
    if (!hasDeepLink) {
      setHighlightMatchId(null)
      return
    }
    if (tournament) setTournamentId(tournament)
    if (group) setGroupId(group)
    const parsedStatus = parseAdminMatchesStatusQueryParam(statusRaw)
    if (parsedStatus && STATUS_FILTER_ALLOWED.includes(parsedStatus)) {
      setStatus(parsedStatus)
    }
    if (isMatchesAdminTabId(tabRaw)) {
      setTab(tabRaw)
    } else if (parsedStatus === 'score_disputed') {
      setTab('disputed')
    }
    setHighlightMatchId(matchFocus)
  }, [searchParams])

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
            : (playerOpts.find((p) => p.id === playerGroupPlayerId)?.label ?? 'Jugador'),
        onValueChange: (value) => setPlayerGroupPlayerId(value ?? 'all'),
        items: [{ value: 'all', label: 'Todos' }, ...playerOpts.map((p) => ({ value: p.id, label: p.label }))],
      },
      {
        id: 'status',
        label: 'Estado',
        value: status === 'all' || STATUS_FILTER_ALLOWED.includes(status) ? status : 'all',
        valueLabel:
          status === 'all' || !STATUS_FILTER_ALLOWED.includes(status)
            ? 'Todos'
            : status === 'player_confirmed'
              ? 'Pendientes'
              : status === 'score_submitted'
                ? 'Registrados'
                : 'Refutados',
        onValueChange: (value) => setStatus((value ?? 'all') as MatchStatus | 'all'),
        items: [
          { value: 'all', label: 'Todos' },
          { value: 'player_confirmed', label: 'Pendientes' },
          { value: 'score_submitted', label: 'Registrados' },
          { value: 'score_disputed', label: 'Refutados' },
        ],
      },
    ]
  }, [tournamentId, tournamentOpts, groupId, groupOpts, playerGroupPlayerId, playerOpts, status])

  const loadingShell = matchesQ.isLoading

  return (
    <div className="space-y-5 sm:space-y-7 md:space-y-9 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <AdminPageHeader
          eyebrow="Administración"
          title="Partidos"
          description="Administra partidos, marcadores, refutaciones y resultados oficiales del torneo."
        />
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            to="/admin/matches/import"
            className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 bg-[#1F5A4C] text-white hover:bg-[#174a3f]')}
          >
            <Upload className="size-3.5 opacity-90" aria-hidden />
            Importar resultados
          </Link>
          <Link to="/admin/exports" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'gap-1.5 bg-white')}>
            <Download className="size-3.5 opacity-80" aria-hidden />
            Exportar
          </Link>
          <Link to="/admin/groups" className={cn(buttonVariants({ size: 'sm', variant: 'secondary' }), 'gap-1.5')}>
            <User className="size-3.5 opacity-90" aria-hidden />
            Crear partido manual
          </Link>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={async () => {
              await qc.invalidateQueries({
                predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'tournament-dashboard',
              })
              await qc.invalidateQueries({
                predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'playerViewModel',
              })
              toast.success('Rankings y vistas del dashboard refrescados.')
            }}
          >
            <Zap className="size-3.5 opacity-90" aria-hidden />
            Recalcular rankings
          </Button>
        </div>
      </div>

      <AdminMatchScopeFiltersBar
        heading="Filtros"
        description="Torneo, grupo, jugador, estado y búsqueda por nombre."
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Buscar por jugador, grupo o torneo…',
          ariaLabel: 'Buscar partidos',
        }}
        selects={matchScopeFilterSelects}
        onClear={() => {
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
          />
        ) : loadingShell ? (
          <Skeleton className="h-96 rounded-2xl" />
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

      <MatchScoreModal
        match={editingResult}
        rules={rulesForEditor.data ?? null}
        open={Boolean(editingResult)}
        onOpenChange={(open) => {
          if (!open) setEditingResult(null)
        }}
        onSubmit={(input) => resultMut.mutate(input)}
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
