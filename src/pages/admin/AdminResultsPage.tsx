import { AlertTriangle, CheckCircle2, Gavel, ListFilter, Pencil, Search, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ResultReviewCard } from '@/components/admin/results/ResultReviewCard'
import { ScoreEditorModal } from '@/components/admin/results/ScoreEditorModal'
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
  getAdminMatches,
  getAdminResults,
  type AdminMatchRecord,
} from '@/services/admin'
import { getTournamentRules } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { MatchStatus, ScoreSet } from '@/types/database'

export function AdminResultsPage() {
  const qc = useQueryClient()
  const actorId = useAuthStore((s) => s.user?.id)
  const [status, setStatus] = useState<MatchStatus | 'all'>('all')
  const [groupId, setGroupId] = useState('all')
  const [search, setSearch] = useState('')
  const [editingMatch, setEditingMatch] = useState<AdminMatchRecord | null>(null)

  const matchesQ = useQuery({ queryKey: ['admin-matches'], queryFn: () => getAdminMatches() })
  const groupsQ = useQuery({ queryKey: ['admin-groups'], queryFn: () => getAdminGroups() })
  const rulesForEditor = useQuery({
    queryKey: ['tournament-rules', editingMatch?.tournament_id ?? ''],
    queryFn: () => getTournamentRules(editingMatch!.tournament_id),
    enabled: Boolean(editingMatch?.tournament_id),
  })
  const resultsQ = useQuery({ queryKey: ['admin-results'], queryFn: getAdminResults })
  const breakdown = useMemo(() => computeAdminMatchBreakdown(matchesQ.data ?? []), [matchesQ.data])

  const recentResults = useMemo(() => {
    const rows = [...(matchesQ.data ?? [])]
    rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return rows.filter((m) => m.score_raw && m.score_raw.length > 0).slice(0, 5)
  }, [matchesQ.data])

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
    mutationFn: async (input: { match: AdminMatchRecord; sets: ScoreSet[] }) => {
      if (!actorId) throw new Error('No autenticado')
      await correctResult(input.match, input.sets, actorId)
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
      const okStatus = status === 'all' || match.status === status
      const okGroup = groupId === 'all' || match.group_id === groupId
      if (!okStatus || !okGroup) return false
      if (!q) return true
      const hay = `${match.playerAName} ${match.playerBName} ${match.groupName} ${match.tournamentName}`.toLowerCase()
      return hay.includes(q)
    })
  }, [groupId, resultsQ.data, search, status])

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
          title="Qué requiere tu atención"
          description="Prioriza pendientes de revisión y valida el flujo de confirmación."
        />
        {matchesQ.isLoading ? (
          <div className={ADMIN_METRIC_GRID_3}>
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-[5.5rem] rounded-2xl sm:h-24" />
            ))}
          </div>
        ) : (
          <div className={ADMIN_METRIC_GRID_3}>
            <AdminMetricCard
              label="Marcadores con flujo"
              value={breakdown.withOutcome}
              icon={Trophy}
              tone="neutral"
              description="En captura, revisión o cerrados"
            />
            <AdminMetricCard
              label="Pendientes de revisión"
              value={breakdown.needsAdminAttention}
              icon={AlertTriangle}
              tone="warning"
              description="Listos para cerrar o en disputa"
            />
            <AdminMetricCard
              label="Cerrados (ranking)"
              value={breakdown.closed}
              icon={CheckCircle2}
              tone="success"
              description="Oficialmente cerrados"
            />
            <AdminMetricCard
              label="Validados (intermedio)"
              value={breakdown.adminValidated}
              icon={Pencil}
              tone="info"
              description="Marcados validados por admin sin cierre final"
            />
            <AdminMetricCard
              label="W/O y no estándar"
              value={breakdown.defaultResults}
              icon={Gavel}
              tone={breakdown.defaultResults > 0 ? 'warning' : 'neutral'}
              description="Resultados por walkover u otros"
            />
            <AdminMetricCard
              label="Total partidos"
              value={breakdown.total}
              icon={CheckCircle2}
              tone="neutral"
              description="Base de cruces del sistema"
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
          <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:flex sm:flex-1 sm:flex-wrap sm:gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-2 sm:min-w-[12rem]">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <ListFilter className="size-3.5" aria-hidden />
                Grupo
              </Label>
              <Select value={groupId} onValueChange={(value) => setGroupId(value ?? 'all')}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los grupos</SelectItem>
                  {(groupsQ.data ?? []).map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2 sm:min-w-[12rem]">
              <Label className="text-xs font-medium text-slate-600">Estado del partido</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as MatchStatus | 'all')}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="scheduled">Programados</SelectItem>
                  <SelectItem value="ready_for_score">Listos para marcador</SelectItem>
                  <SelectItem value="score_submitted">Marcador enviado</SelectItem>
                  <SelectItem value="score_disputed">En disputa</SelectItem>
                  <SelectItem value="player_confirmed">Aceptado por rival</SelectItem>
                  <SelectItem value="admin_validated">Validado por admin</SelectItem>
                  <SelectItem value="closed">Cerrados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" variant="outline" className="h-11 w-full shrink-0 sm:w-auto" onClick={() => { setSearch(''); setGroupId('all'); setStatus('all') }}>
            Limpiar
          </Button>
        </AdminToolbar>
      </section>

      {recentResults.length > 0 && !matchesQ.isLoading ? (
        <section className="space-y-3" aria-labelledby="results-recent-heading">
          <AdminSectionTitle
            id="results-recent-heading"
            title="Últimos marcadores registrados"
            description="Ordenados por fecha de actualización."
          />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentResults.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <p className="font-medium text-slate-900">
                  {m.playerAName} vs {m.playerBName}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(m.updated_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4" aria-labelledby="results-list-heading">
        <AdminSectionTitle
          id="results-list-heading"
          title="Revisión de marcadores"
          description="Confirma envíos de jugadores o abre el editor para corregir sets."
        />
        {resultsQ.isError ? (
          <AdminEmptyState
            title="No se pudieron cargar los resultados."
            description={resultsQ.error instanceof Error ? resultsQ.error.message : 'Revisa permisos o conexión con Supabase.'}
            icon={CheckCircle2}
          />
        ) : resultsQ.isLoading ? (
          <Skeleton className="h-72 rounded-2xl" />
        ) : filteredResults.length === 0 ? (
          <AdminEmptyState
            title="No hay partidos con ese filtro."
            description="Cambia filtros o revisa la sección Partidos para generar cruces."
            icon={CheckCircle2}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredResults.map((match) => (
              <ResultReviewCard
                key={match.id}
                match={match}
                onConfirm={(nextMatch) => confirmMut.mutate(nextMatch)}
                onCorrect={(nextMatch) => setEditingMatch(nextMatch)}
              />
            ))}
          </div>
        )}
      </section>

      <ScoreEditorModal
        match={editingMatch}
        rules={rulesForEditor.data ?? null}
        open={Boolean(editingMatch)}
        onOpenChange={(open) => {
          if (!open) setEditingMatch(null)
        }}
        onSubmit={(match, sets) => correctMut.mutate({ match, sets })}
      />
    </div>
  )
}
