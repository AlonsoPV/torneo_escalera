import { AlertTriangle, CheckCircle2, Clock3, Pencil, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ResultReviewCard } from '@/components/admin/results/ResultReviewCard'
import { ScoreEditorModal } from '@/components/admin/results/ScoreEditorModal'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminFilterCard } from '@/components/admin/shared/AdminFilterCard'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
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
  confirmResult,
  correctResult,
  getAdminMatches,
  getAdminResults,
  type AdminMatchRecord,
} from '@/services/admin'
import { useAuthStore } from '@/stores/authStore'
import type { MatchStatus, ScoreSet } from '@/types/database'

export function AdminResultsPage() {
  const qc = useQueryClient()
  const actorId = useAuthStore((s) => s.user?.id)
  const [status, setStatus] = useState<MatchStatus | 'all'>('all')
  const [editingMatch, setEditingMatch] = useState<AdminMatchRecord | null>(null)

  const matchesQ = useQuery({ queryKey: ['admin-matches'], queryFn: () => getAdminMatches() })
  const resultsQ = useQuery({ queryKey: ['admin-results'], queryFn: getAdminResults })
  const resultStats = useMemo(() => {
    const matches = matchesQ.data ?? []
    const toPlayStatuses: MatchStatus[] = ['pending', 'scheduled', 'ready_for_result']
    const playedStatuses: MatchStatus[] = ['result_submitted', 'confirmed', 'corrected']

    return {
      generated: matches.length,
      toPlay: matches.filter((match) => toPlayStatuses.includes(match.status)).length,
      played: matches.filter((match) => playedStatuses.includes(match.status)).length,
      pendingReview: matches.filter((match) => match.status === 'result_submitted').length,
      confirmed: matches.filter((match) => match.status === 'confirmed').length,
      corrected: matches.filter((match) => match.status === 'corrected').length,
    }
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

  const filteredResults = useMemo(
    () => (resultsQ.data ?? []).filter((match) => status === 'all' || match.status === status),
    [resultsQ.data, status],
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Resultados"
        title="Revisión de resultados"
        description="Consulta todos los partidos por estado y confirma o corrige marcadores cuando existan."
      />

      {matchesQ.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-6">
          <AdminMetricCard label="Generados" value={resultStats.generated} icon={Trophy} />
          <AdminMetricCard label="Por jugar" value={resultStats.toPlay} icon={Clock3} tone="pending" />
          <AdminMetricCard label="Jugados" value={resultStats.played} icon={CheckCircle2} tone="success" />
          <AdminMetricCard
            label="Por revisar"
            value={resultStats.pendingReview}
            icon={AlertTriangle}
            tone="warning"
          />
          <AdminMetricCard label="Confirmados" value={resultStats.confirmed} icon={CheckCircle2} tone="success" />
          <AdminMetricCard label="Corregidos" value={resultStats.corrected} icon={Pencil} />
        </div>
      )}

      <AdminFilterCard>
        <Label className="mb-2 block text-sm font-medium text-[#102A43]">Estado del partido</Label>
        <Select value={status} onValueChange={(value) => setStatus(value as MatchStatus | 'all')}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los resultados</SelectItem>
            <SelectItem value="pending">Pendientes de agenda</SelectItem>
            <SelectItem value="scheduled">Programados</SelectItem>
            <SelectItem value="ready_for_result">Listos para marcador</SelectItem>
            <SelectItem value="result_submitted">Pendientes de confirmación</SelectItem>
            <SelectItem value="confirmed">Confirmados</SelectItem>
            <SelectItem value="corrected">Corregidos</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </AdminFilterCard>

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
          description="Cambia el estado seleccionado o genera partidos desde la gestión del torneo."
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

      <ScoreEditorModal
        match={editingMatch}
        open={Boolean(editingMatch)}
        onOpenChange={(open) => {
          if (!open) setEditingMatch(null)
        }}
        onSubmit={(match, sets) => correctMut.mutate({ match, sets })}
      />
    </div>
  )
}
