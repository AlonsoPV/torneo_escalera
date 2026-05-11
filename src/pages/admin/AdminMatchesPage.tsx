import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ListFilter,
  Search,
  Trophy,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AdminMatchTable } from '@/components/admin/matches/AdminMatchTable'
import { AdminScoreCorrectionModal } from '@/components/admin/results/AdminScoreCorrectionModal'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminMetricCard, ADMIN_METRIC_GRID_4 } from '@/components/admin/shared/AdminMetricCard'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { cancelResult, computeAdminMatchBreakdown, correctResult, getAdminGroups, getAdminMatches, type AdminMatchRecord } from '@/services/admin'
import { getTournamentRules } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { MatchStatus, ScoreSet } from '@/types/database'

export function AdminMatchesPage() {
  const qc = useQueryClient()
  const actorId = useAuthStore((s) => s.user?.id)
  const [groupId, setGroupId] = useState('all')
  const [status, setStatus] = useState<MatchStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [editingResult, setEditingResult] = useState<AdminMatchRecord | null>(null)

  const matchesQ = useQuery({ queryKey: ['admin-matches'], queryFn: () => getAdminMatches() })
  const groupsQ = useQuery({ queryKey: ['admin-groups'], queryFn: () => getAdminGroups() })
  const rulesForEditor = useQuery({
    queryKey: ['tournament-rules', editingResult?.tournament_id ?? ''],
    queryFn: () => getTournamentRules(editingResult!.tournament_id),
    enabled: Boolean(editingResult?.tournament_id),
  })
  const breakdown = useMemo(() => computeAdminMatchBreakdown(matchesQ.data ?? []), [matchesQ.data])

  const resultMut = useMutation({
    mutationFn: async (input: { match: AdminMatchRecord; sets: ScoreSet[]; closeAfter: boolean; adminNote: string }) => {
      if (!actorId) throw new Error('No autenticado')
      await correctResult(input.match, input.sets, actorId, input.closeAfter, input.adminNote)
    },
    onSuccess: async (_data, variables) => {
      toast.success(variables.closeAfter ? 'Resultado confirmado' : 'Corrección guardada')
      setEditingResult(null)
      await qc.invalidateQueries({ queryKey: ['admin-matches'] })
      await qc.invalidateQueries({ queryKey: ['admin-results'] })
      await qc.invalidateQueries({ queryKey: ['admin-overview'] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al editar resultado'),
  })

  const cancelMut = useMutation({
    mutationFn: async (match: AdminMatchRecord) => {
      if (!actorId) throw new Error('No autenticado')
      await cancelResult(match.id, actorId)
    },
    onSuccess: async () => {
      toast.success('Partido cancelado')
      await qc.invalidateQueries({ queryKey: ['admin-matches'] })
      await qc.invalidateQueries({ queryKey: ['admin-results'] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al cancelar partido'),
  })

  const filteredMatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (matchesQ.data ?? []).filter((match) => {
      const matchesGroup = groupId === 'all' || match.group_id === groupId
      const matchesStatus = status === 'all' || match.status === status
      if (!matchesGroup || !matchesStatus) return false
      if (!q) return true
      const hay = `${match.playerAName} ${match.playerBName} ${match.groupName} ${match.tournamentName}`.toLowerCase()
      return hay.includes(q)
    })
  }, [groupId, matchesQ.data, search, status])

  return (
    <div className="space-y-5 sm:space-y-8 md:space-y-10">
      <AdminPageHeader
        eyebrow="Administración"
        title="Partidos"
        description="Monitorea los cruces del torneo. Filtra por grupo o estado y revisa marcadores."
      />

      <section className="space-y-3 sm:space-y-4" aria-labelledby="matches-metrics-heading">
        <AdminSectionTitle
          id="matches-metrics-heading"
          title="Resumen operativo"
          description="Conteos globales para priorizar marcadores pendientes y partidos que requieren acción."
        />
        {matchesQ.isLoading ? (
          <div className={ADMIN_METRIC_GRID_4}>
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-[5.5rem] rounded-2xl sm:h-24" />
            ))}
          </div>
        ) : (
          <div className={ADMIN_METRIC_GRID_4}>
            <AdminMetricCard
              label="Total partidos"
              value={breakdown.total}
              icon={Trophy}
              tone="neutral"
              description="Todos los cruces generados"
            />
            <AdminMetricCard
              label="Pendientes de marcador"
              value={breakdown.pendingScore}
              icon={CalendarClock}
              tone="info"
              description="Disponibles para captura por Jugador A"
            />
            <AdminMetricCard
              label="Esperando al rival"
              value={breakdown.scoreSubmitted}
              icon={AlertTriangle}
              tone="warning"
              description="Marcador enviado por Jugador A"
            />
            <AdminMetricCard
              label="Jugados (con resultado)"
              value={breakdown.withOutcome}
              icon={CheckCircle2}
              tone="success"
              description="En flujo de marcador o cerrado oficialmente"
            />
            <AdminMetricCard
              label="Revisión admin"
              value={breakdown.needsAdminAttention}
              icon={AlertTriangle}
              tone="warning"
              description="Aceptado por rival o en disputa"
            />
            <AdminMetricCard
              label="Cerrados (ranking)"
              value={breakdown.closed}
              icon={CheckCircle2}
              tone="success"
              description="Validados y cerrados oficialmente"
            />
            <AdminMetricCard
              label="Cancelados"
              value={breakdown.cancelled}
              icon={XCircle}
              tone="danger"
              description="Partidos dados de baja"
            />
          </div>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="matches-toolbar-heading">
        <AdminSectionTitle
          id="matches-toolbar-heading"
          title="Filtros y búsqueda"
          description="Encuentra partidos por jugador, grupo o torneo."
          action={
            breakdown.needsAdminAttention > 0 ? (
              <Link className={buttonVariants({ variant: 'default', size: 'sm', className: 'w-full sm:w-auto' })} to="/admin/results">
                Revisar {breakdown.needsAdminAttention} pendiente{breakdown.needsAdminAttention === 1 ? '' : 's'}
              </Link>
            ) : null
          }
        />
        <AdminToolbar>
          <div className="relative w-full min-w-0 sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              className="h-11 pl-10"
              placeholder="Buscar jugador, grupo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar partidos"
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
              <Label className="text-xs font-medium text-slate-600">Estado</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as MatchStatus | 'all')}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending_score">Pendiente de marcador</SelectItem>
                  <SelectItem value="score_submitted">Marcador enviado</SelectItem>
                  <SelectItem value="score_disputed">Marcador en disputa</SelectItem>
                  <SelectItem value="player_confirmed">Aceptado por rival</SelectItem>
                  <SelectItem value="closed">Cerrado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" variant="outline" className="h-11 w-full shrink-0 sm:w-auto" onClick={() => { setSearch(''); setGroupId('all'); setStatus('all') }}>
            Limpiar filtros
          </Button>
        </AdminToolbar>
      </section>

      <section className="space-y-4" aria-labelledby="matches-list-heading">
        <AdminSectionTitle
          id="matches-list-heading"
          title="Gestión de partidos"
          description="Tabla en escritorio; tarjetas en móvil. Usa «Editar resultado» para corregir marcadores."
        />
        {matchesQ.isError ? (
          <AdminEmptyState
            title="No se pudieron cargar los partidos."
            description={matchesQ.error instanceof Error ? matchesQ.error.message : 'Revisa permisos o conexión con Supabase.'}
            icon={CalendarClock}
          />
        ) : matchesQ.isLoading ? (
          <Skeleton className="h-72 rounded-2xl" />
        ) : filteredMatches.length === 0 ? (
          <AdminEmptyState
            title="No hay partidos con esos filtros."
            description="Cambia la búsqueda o genera partidos desde Grupos o el detalle del torneo."
            icon={CalendarClock}
          />
        ) : (
          <AdminMatchTable
            matches={filteredMatches}
            onEditResult={(match) => setEditingResult(match)}
            onCancel={(match) => cancelMut.mutate(match)}
          />
        )}
      </section>

      <AdminScoreCorrectionModal
        match={editingResult}
        rules={rulesForEditor.data ?? null}
        open={Boolean(editingResult)}
        onOpenChange={(open) => {
          if (!open) setEditingResult(null)
        }}
        onSubmit={(input) => resultMut.mutate(input)}
      />
    </div>
  )
}
