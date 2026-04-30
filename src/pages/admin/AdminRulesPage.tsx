import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { AdminRulesEditor } from '@/components/admin/rules/AdminRulesEditor'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { listTournaments, updateTournament } from '@/services/tournaments'

export function AdminRulesPage() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const tournamentsQ = useQuery({ queryKey: ['admin-tournaments'], queryFn: listTournaments })
  const tournaments = tournamentsQ.data ?? []
  const selectedTournamentId = searchParams.get('tournament')
  const selectedTournament = useMemo(
    () =>
      tournaments.find((tournament) => tournament.id === selectedTournamentId) ??
      tournaments.find((tournament) => tournament.status !== 'finished') ??
      tournaments[0] ??
      null,
    [selectedTournamentId, tournaments],
  )

  const publishMut = useMutation({
    mutationFn: async (id: string) => updateTournament(id, { status: 'active' }),
    onSuccess: async () => {
      toast.success('Torneo publicado como activo')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-tournaments'] }),
        qc.invalidateQueries({ queryKey: ['tournaments'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al publicar torneo'),
  })

  return (
    <div id="page-admin-rules" className="min-h-0 space-y-6 sm:space-y-8">
      {tournamentsQ.isLoading ? (
        <Skeleton id="admin-rules-loading" className="h-32 rounded-2xl" />
      ) : tournaments.length === 0 ? (
        <AdminEmptyState
          id="admin-rules-empty"
          title="No hay torneo activo para configurar reglas."
          description="Crea un torneo primero. Luego podrás definir puntuación, defaults y formato desde esta pantalla."
        />
      ) : !selectedTournament ? (
        <AdminEmptyState
          id="admin-rules-empty-finished"
          title="No hay torneo disponible."
          description="Todos los torneos están finalizados. Crea uno nuevo o reabre el flujo desde administración de torneos."
        />
      ) : (
        <AdminRulesEditor
          tournament={selectedTournament}
          tournaments={tournaments}
          onTournamentChange={(nextTournamentId) => {
            if (nextTournamentId) setSearchParams({ tournament: nextTournamentId }, { replace: true })
          }}
          onPublish={() => publishMut.mutate(selectedTournament.id)}
          publishing={publishMut.isPending}
        />
      )}
    </div>
  )
}
