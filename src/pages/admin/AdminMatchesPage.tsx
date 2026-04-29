import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Trophy, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AdminMatchTable } from '@/components/admin/matches/AdminMatchTable'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { ScoreEditorModal } from '@/components/admin/results/ScoreEditorModal'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { correctResult, getAdminGroups, getAdminMatches, type AdminMatchRecord } from '@/services/admin'
import { useAuthStore } from '@/stores/authStore'
import type { MatchStatus, ScoreSet } from '@/types/database'

export function AdminMatchesPage() {
  const qc = useQueryClient()
  const actorId = useAuthStore((s) => s.user?.id)
  const [groupId, setGroupId] = useState('all')
  const [status, setStatus] = useState<MatchStatus | 'all'>('all')
  const [editingResult, setEditingResult] = useState<AdminMatchRecord | null>(null)

  const matchesQ = useQuery({ queryKey: ['admin-matches'], queryFn: () => getAdminMatches() })
  const groupsQ = useQuery({ queryKey: ['admin-groups'], queryFn: () => getAdminGroups() })
  const matchStats = useMemo(() => {
    const matches = matchesQ.data ?? []
    const toPlayStatuses: MatchStatus[] = ['pending', 'scheduled', 'ready_for_result']
    const playedStatuses: MatchStatus[] = ['result_submitted', 'confirmed', 'corrected']

    return {
      generated: matches.length,
      toPlay: matches.filter((match) => toPlayStatuses.includes(match.status)).length,
      played: matches.filter((match) => playedStatuses.includes(match.status)).length,
      pendingReview: matches.filter((match) => match.status === 'result_submitted').length,
      cancelled: matches.filter((match) => match.status === 'cancelled').length,
    }
  }, [matchesQ.data])

  const resultMut = useMutation({
    mutationFn: async (input: { match: AdminMatchRecord; sets: ScoreSet[] }) => {
      if (!actorId) throw new Error('No autenticado')
      await correctResult(input.match, input.sets, actorId)
    },
    onSuccess: async () => {
      toast.success('Resultado actualizado')
      setEditingResult(null)
      await qc.invalidateQueries({ queryKey: ['admin-matches'] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al editar resultado'),
  })

  const filteredMatches = useMemo(
    () =>
      (matchesQ.data ?? []).filter((match) => {
        const matchesGroup = groupId === 'all' || match.group_id === groupId
        const matchesStatus = status === 'all' || match.status === status
        return matchesGroup && matchesStatus
      }),
    [groupId, matchesQ.data, status],
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Partidos"
        title="Seguimiento de partidos"
        description="Filtra por grupo o estado y revisa o edita marcadores registrados."
      />

      {matchesQ.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
          <AdminMetricCard label="Generados" value={matchStats.generated} icon={Trophy} />
          <AdminMetricCard label="Por jugar" value={matchStats.toPlay} icon={Clock3} tone="pending" />
          <AdminMetricCard label="Jugados" value={matchStats.played} icon={CheckCircle2} tone="success" />
          <AdminMetricCard
            label="Pendientes de revisión"
            value={matchStats.pendingReview}
            icon={AlertTriangle}
            tone="warning"
          />
          <AdminMetricCard label="Cancelados" value={matchStats.cancelled} icon={XCircle} tone="danger" />
        </div>
      )}

      <Card className="border-[#E2E8F0] bg-white shadow-sm">
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Grupo</Label>
            <Select value={groupId} onValueChange={(value) => setGroupId(value ?? 'all')}>
              <SelectTrigger>
                <SelectValue />
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
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as MatchStatus | 'all')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="scheduled">Programado</SelectItem>
                <SelectItem value="ready_for_result">Listo para marcador</SelectItem>
                <SelectItem value="result_submitted">Resultado enviado</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="corrected">Corregido</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
          description="Cambia los filtros o genera partidos desde la gestión del torneo."
          icon={CalendarClock}
        />
      ) : (
        <AdminMatchTable matches={filteredMatches} onEditResult={(match) => setEditingResult(match)} />
      )}

      <ScoreEditorModal
        match={editingResult}
        open={Boolean(editingResult)}
        onOpenChange={(open) => {
          if (!open) setEditingResult(null)
        }}
        onSubmit={(match, sets) => resultMut.mutate({ match, sets })}
      />
    </div>
  )
}
