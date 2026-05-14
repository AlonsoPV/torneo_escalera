import { CheckCircle2, ClipboardList, ListFilter, Search, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AdminScoreCorrectionModal } from '@/components/admin/results/AdminScoreCorrectionModal'
import { ResultReviewCard } from '@/components/admin/results/ResultReviewCard'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminMetricCard, ADMIN_METRIC_GRID_3 } from '@/components/admin/shared/AdminMetricCard'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  computeAdminMatchBreakdown,
  confirmResult,
  correctResult,
  getAdminGroups,
  getAdminResults,
  type AdminMatchRecord,
} from '@/services/admin'
import { getTournamentRules } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { ScoreSet } from '@/types/database'

type ResultsQueueFilter = 'all' | 'to_validate' | 'disputed' | 'waiting_rival' | 'official'

export function AdminResultsPage() {
  const qc = useQueryClient()
  const actorId = useAuthStore((s) => s.user?.id)
  const [groupId, setGroupId] = useState('all')
  const [queueFilter, setQueueFilter] = useState<ResultsQueueFilter>('all')
  const [search, setSearch] = useState('')
  const [editingMatch, setEditingMatch] = useState<AdminMatchRecord | null>(null)

  const groupsQ = useQuery({ queryKey: ['admin-groups'], queryFn: () => getAdminGroups() })
  const rulesForEditor = useQuery({
    queryKey: ['tournament-rules', editingMatch?.tournament_id ?? ''],
    queryFn: () => getTournamentRules(editingMatch!.tournament_id),
    enabled: Boolean(editingMatch?.tournament_id),
  })
  const resultsQ = useQuery({ queryKey: ['admin-results'], queryFn: getAdminResults })
  const breakdown = useMemo(() => computeAdminMatchBreakdown(resultsQ.data ?? []), [resultsQ.data])

  const refreshResults = async () => {
    await qc.invalidateQueries({ queryKey: ['admin-results'] })
    await qc.invalidateQueries({ queryKey: ['admin-matches'] })
    await qc.invalidateQueries({ queryKey: ['admin-overview'] })
  }

  const confirmMut = useMutation({
    mutationFn: async (match: AdminMatchRecord) => {
      if (!actorId) throw new Error('No autenticado')
      await confirmResult(match, actorId)
    },
    onSuccess: async () => {
      toast.success('Resultado confirmado')
      await refreshResults()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al confirmar resultado'),
  })

  const correctMut = useMutation({
    mutationFn: async (input: { match: AdminMatchRecord; sets: ScoreSet[]; closeAfter: boolean; adminNote: string }) => {
      if (!actorId) throw new Error('No autenticado')
      await correctResult(input.match, input.sets, actorId, input.closeAfter, input.adminNote)
    },
    onSuccess: async () => {
      toast.success('Marcador corregido')
      setEditingMatch(null)
      await refreshResults()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al corregir marcador'),
  })

  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (resultsQ.data ?? []).filter((match) => {
      const okGroup = groupId === 'all' || match.group_id === groupId
      if (!okGroup) return false
      if (!q) return true
      const hay = `${match.playerAName} ${match.playerBName} ${match.groupName} ${match.tournamentName}`.toLowerCase()
      if (!hay.includes(q)) return false
      return true
    })
  }, [groupId, resultsQ.data, search])

  const queueFilteredResults = useMemo(() => {
    if (queueFilter === 'to_validate') return filteredResults.filter((match) => match.status === 'player_confirmed')
    if (queueFilter === 'disputed') return filteredResults.filter((match) => match.status === 'score_disputed')
    if (queueFilter === 'waiting_rival') return filteredResults.filter((match) => match.status === 'score_submitted')
    if (queueFilter === 'official') return filteredResults.filter((match) => match.status === 'closed')
    return filteredResults
  }, [filteredResults, queueFilter])

  const actionRequired = useMemo(
    () => queueFilteredResults.filter((match) => match.status === 'player_confirmed'),
    [queueFilteredResults],
  )
  const disputed = useMemo(
    () => queueFilteredResults.filter((match) => match.status === 'score_disputed'),
    [queueFilteredResults],
  )
  const followUp = useMemo(
    () => queueFilteredResults.filter((match) => match.status === 'score_submitted'),
    [queueFilteredResults],
  )
  const history = useMemo(
    () => queueFilteredResults.filter((match) => match.status === 'closed'),
    [queueFilteredResults],
  )

  const renderQueue = (
    matches: AdminMatchRecord[],
    emptyTitle: string,
    emptyDescription: string,
  ) => {
    if (resultsQ.isLoading) return <Skeleton className="h-72 rounded-2xl" />
    if (matches.length === 0) {
      return <AdminEmptyState title={emptyTitle} description={emptyDescription} icon={CheckCircle2} />
    }
    return (
      <div className="grid grid-cols-1 gap-4">
        {matches.map((match) => (
          <ResultReviewCard
            key={match.id}
            match={match}
            onConfirm={(nextMatch) => confirmMut.mutate(nextMatch)}
            onCorrect={(nextMatch) => setEditingMatch(nextMatch)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-8 md:space-y-10">
      <AdminPageHeader
        eyebrow="Administración"
        title="Resultados"
        description="Revisa marcadores registrados por jugadores, confirma resultados y corrige incidencias."
      />

      <section className="space-y-3 sm:space-y-4" aria-labelledby="results-metrics-heading">
        <AdminSectionTitle
          id="results-metrics-heading"
          title="Resumen"
          description="Totales de partidos, captura por jugador A y cierres oficiales."
        />
        {resultsQ.isLoading ? (
          <div className={ADMIN_METRIC_GRID_3}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-[5.5rem] rounded-2xl sm:h-24" />
            ))}
          </div>
        ) : (
          <div className={ADMIN_METRIC_GRID_3}>
            <AdminMetricCard
              label="Total de partidos"
              value={breakdown.total}
              icon={Trophy}
              tone="neutral"
              description="Todos los cruces generados"
            />
            <AdminMetricCard
              label="Partidos con marcador"
              value={breakdown.withOutcome}
              icon={ClipboardList}
              tone="info"
              description="Jugador A registró marcador (y estados siguientes del flujo)"
            />
            <AdminMetricCard
              label="Partidos cerrados"
              value={breakdown.closed}
              icon={CheckCircle2}
              tone="success"
              description="Validados y cerrados oficialmente"
            />
          </div>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="results-toolbar-heading">
        <AdminSectionTitle
          id="results-toolbar-heading"
          title="Filtros"
          description="Acota por estado, grupo o texto."
        />
        <AdminToolbar>
          <div className="relative w-full min-w-0 sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              className="h-11 pl-10"
              placeholder="Buscar jugador o grupo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar en resultados"
            />
          </div>
          <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:flex sm:flex-1 sm:flex-wrap sm:gap-4">
            <div className="min-w-0 space-y-2 sm:min-w-[12rem]">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <ListFilter className="size-3.5" aria-hidden />
                Grupo
              </Label>
              <Select value={groupId} onValueChange={(value) => setGroupId(value ?? 'all')}>
                <SelectTrigger className="h-11 min-w-[180px] w-full">
                  <SelectValue placeholder="Grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" label="Todos los grupos">
                    Todos los grupos
                  </SelectItem>
                  {(groupsQ.data ?? []).map((group) => (
                    <SelectItem key={group.id} value={group.id} label={group.name}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2 sm:min-w-[12rem]">
              <Label className="text-xs font-medium text-slate-600">Cola</Label>
              <Select value={queueFilter} onValueChange={(value) => setQueueFilter((value ?? 'all') as ResultsQueueFilter)}>
                <SelectTrigger className="h-11 min-w-[180px] w-full">
                  <SelectValue placeholder="Cola" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" label="Todos">
                    Todos
                  </SelectItem>
                  <SelectItem value="to_validate" label="Por validar">
                    Por validar
                  </SelectItem>
                  <SelectItem value="disputed" label="En disputa">
                    En disputa
                  </SelectItem>
                  <SelectItem value="waiting_rival" label="Esperando rival">
                    Esperando rival
                  </SelectItem>
                  <SelectItem value="official" label="Oficiales">
                    Oficiales
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" variant="outline" className="h-11 w-full shrink-0 sm:w-auto" onClick={() => { setSearch(''); setGroupId('all'); setQueueFilter('all') }}>
            Limpiar
          </Button>
        </AdminToolbar>
      </section>

      {resultsQ.isError ? (
        <AdminEmptyState
          title="No se pudieron cargar los resultados."
          description={resultsQ.error instanceof Error ? resultsQ.error.message : 'Revisa permisos o conexión con Supabase.'}
          icon={CheckCircle2}
        />
      ) : queueFilteredResults.length === 0 && !resultsQ.isLoading ? (
        <section className="space-y-4" aria-labelledby="results-empty-heading">
          <AdminSectionTitle
            id="results-empty-heading"
            title="Revisión de marcadores"
            description="No hay resultados que coincidan con tus filtros."
          />
          <AdminEmptyState
            title="No hay partidos con ese filtro."
            description="Cambia filtros o revisa la sección Partidos para generar cruces."
            icon={CheckCircle2}
          />
        </section>
      ) : (
        <>
          <section className="space-y-4" aria-labelledby="results-action-heading">
            <AdminSectionTitle
              id="results-action-heading"
              title="Por validar"
              description="Resultados aceptados por rival pendientes de cierre administrativo."
            />
            {renderQueue(actionRequired, 'No hay resultados pendientes de validación.', 'Todos los resultados aceptados están al día.')}
          </section>

          <section className="space-y-4" aria-labelledby="results-disputed-heading">
            <AdminSectionTitle
              id="results-disputed-heading"
              title="En disputa"
              description="Marcadores rechazados por el rival que requieren corrección o intervención."
            />
            {renderQueue(disputed, 'No hay disputas activas.', 'No hay marcadores rechazados por resolver.')}
          </section>

          <section className="space-y-4" aria-labelledby="results-follow-heading">
            <AdminSectionTitle
              id="results-follow-heading"
              title="Seguimiento"
              description="Marcadores enviados por Jugador A que esperan aceptación del rival."
            />
            {renderQueue(followUp, 'Tu rival aún no ha aceptado el marcador.', 'No hay marcadores esperando aceptación del rival.')}
          </section>

          <section className="space-y-4" aria-labelledby="results-history-heading">
            <AdminSectionTitle
              id="results-history-heading"
              title="Oficiales"
              description="Resultados oficiales que ya impactan el ranking."
            />
            {renderQueue(history, 'No hay resultados cerrados.', 'Aún no hay partidos oficiales en el historial.')}
          </section>
        </>
      )}

      <AdminScoreCorrectionModal
        match={editingMatch}
        rules={rulesForEditor.data ?? null}
        open={Boolean(editingMatch)}
        onOpenChange={(open) => {
          if (!open) setEditingMatch(null)
        }}
        onSubmit={(input) => correctMut.mutate(input)}
      />
    </div>
  )
}
