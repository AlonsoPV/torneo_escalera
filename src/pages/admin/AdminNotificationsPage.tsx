import { BarChart3, Scale } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  CompactEmpty,
  sortRowsForTab,
  tabFilterRows,
} from '@/components/admin/results/adminResultsReviewUtils'
import { AdminResultReviewRow } from '@/components/admin/results/AdminResultReviewRow'
import { AdminResultsVirtualList } from '@/components/admin/results/AdminResultsVirtualList'
import { AdminScoreCorrectionModal } from '@/components/admin/results/AdminScoreCorrectionModal'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  confirmResult,
  correctResult,
  getAdminResults,
  type AdminMatchRecord,
} from '@/services/admin'
import { adminInvalidateMatchResult, adminValidateDisputedWithoutChanges } from '@/services/matches'
import { getTournamentRules } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { ScoreSet } from '@/types/database'

/** Bandeja ligera: todos los partidos `score_disputed`; filtros y métricas amplias están en Resultados. */
export function AdminNotificationsPage() {
  const qc = useQueryClient()
  const actorId = useAuthStore((s) => s.user?.id)
  const [editingMatch, setEditingMatch] = useState<AdminMatchRecord | null>(null)

  const resultsQ = useQuery({ queryKey: ['admin-results'], queryFn: getAdminResults })
  const rulesForEditor = useQuery({
    queryKey: ['tournament-rules', editingMatch?.tournament_id ?? ''],
    queryFn: () => getTournamentRules(editingMatch!.tournament_id),
    enabled: Boolean(editingMatch?.tournament_id),
  })

  const disputedTabRows = useMemo(() => {
    const filtered = tabFilterRows(resultsQ.data ?? [], 'disputed')
    return sortRowsForTab(filtered, 'disputed')
  }, [resultsQ.data])

  const disputedCount = disputedTabRows.length

  const refreshResults = async (opts?: { touchedMatch?: Pick<AdminMatchRecord, 'id' | 'tournament_id'> }) => {
    await qc.invalidateQueries({ queryKey: ['admin-results'] })
    await qc.invalidateQueries({ queryKey: ['admin-matches'] })
    await qc.invalidateQueries({ queryKey: ['admin-overview'] })
    await qc.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'playerViewModel',
    })
    const tm = opts?.touchedMatch
    if (tm) {
      await qc.invalidateQueries({ queryKey: ['matchScoreLogs', tm.id] })
      await qc.invalidateQueries({ queryKey: ['tournament-dashboard', tm.tournament_id], exact: false })
    }
  }

  const confirmMut = useMutation({
    mutationFn: async (match: AdminMatchRecord) => {
      if (!actorId) throw new Error('No autenticado')
      await confirmResult(match, actorId)
    },
    onSuccess: async (_, match) => {
      toast.success('Resultado validado y cerrado')
      await refreshResults({ touchedMatch: match })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al validar resultado'),
  })

  const correctMut = useMutation({
    mutationFn: async (input: { match: AdminMatchRecord; sets: ScoreSet[]; closeAfter: boolean; adminNote: string }) => {
      if (!actorId) throw new Error('No autenticado')
      await correctResult(input.match, input.sets, actorId, input.closeAfter, input.adminNote)
    },
    onSuccess: async (_, input) => {
      const draftDisputed =
        input.match.status === 'score_disputed' && input.closeAfter === false
      toast.success(draftDisputed ? 'Corrección guardada (sigue en revisión)' : 'Marcador corregido')
      setEditingMatch(null)
      await refreshResults({ touchedMatch: input.match })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al corregir marcador'),
  })

  const validateDisputedMut = useMutation({
    mutationFn: async (match: AdminMatchRecord) => {
      await adminValidateDisputedWithoutChanges(match)
    },
    onSuccess: async (_, match) => {
      toast.success('Resultado validado sin cambios de marcador')
      await refreshResults({ touchedMatch: match })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo validar'),
  })

  const invalidateDisputedMut = useMutation({
    mutationFn: async (match: AdminMatchRecord) => {
      await adminInvalidateMatchResult(match)
    },
    onSuccess: async (_, match) => {
      toast.success('Partido invalidado (cancelado)')
      await refreshResults({ touchedMatch: match })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo invalidar'),
  })

  const loadingShell = resultsQ.isLoading

  return (
    <div className="space-y-4 pb-8">
      <AdminPageHeader
        eyebrow="Administración"
        title="Disputas · revisión"
        description="Marcadores refutados por rivales. Aquí solo ves disputas pendientes; usa Resultados para filtrar por torneo, grupo o jugador."
        actions={
          <Link
            to="/admin/matches?tab=disputed"
            className={cn(buttonVariants({ size: 'sm' }), 'gap-2 bg-[#1F5A4C] text-white hover:bg-[#174a3f]')}
          >
            <BarChart3 className="size-4 opacity-90" aria-hidden />
            Abrir Partidos (filtros)
          </Link>
        }
      />

      <section aria-labelledby="disputes-inbox-heading" className="space-y-3">
        <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 via-white to-white p-4 shadow-sm ring-1 ring-amber-900/[0.04] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-900 shadow-inner shadow-amber-900/5"
                aria-hidden
              >
                <Scale className="size-5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="disputes-inbox-heading" className="text-base font-semibold tracking-tight text-[#102A43]">
                    Bandeja de revisión
                  </h2>
                  <Badge
                    variant="secondary"
                    className="border-amber-200/90 bg-white/90 px-2 py-0 text-[11px] font-bold tabular-nums text-amber-950"
                  >
                    {loadingShell ? '…' : disputedCount}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
                  Lista prioritaria de partidos en{' '}
                  <span className="font-medium text-slate-800">pendiente revisión administrativa</span>. Orden: más
                  recientes primero (última actualización).
                </p>
              </div>
            </div>
          </div>
        </div>

        {resultsQ.isError ? (
          <CompactEmpty title={resultsQ.error instanceof Error ? resultsQ.error.message : 'No se pudieron cargar los datos.'} />
        ) : loadingShell ? (
          <Skeleton className="h-[min(calc(100dvh-13rem),780px)] w-full rounded-2xl" />
        ) : disputedCount === 0 ? (
          <CompactEmpty title="No hay disputas pendientes." />
        ) : (
          <AdminResultsVirtualList
            className="rounded-2xl border-slate-200/95 shadow-sm"
            maxHeight="min(calc(100dvh - 13rem), 900px)"
            estimateRowHeight={96}
            items={disputedTabRows}
            empty={<CompactEmpty title="No hay disputas pendientes." />}
            renderRow={(match) => (
              <AdminResultReviewRow
                match={match}
                quickReview={false}
                onConfirm={(m) => confirmMut.mutate(m)}
                onCorrect={(m) => setEditingMatch(m)}
                onValidateAsIs={(m) => validateDisputedMut.mutate(m)}
                onInvalidate={(m) => {
                  if (!window.confirm('¿Invalidar este partido? Pasará a cancelado y saldrá del ranking.')) return
                  invalidateDisputedMut.mutate(m)
                }}
              />
            )}
          />
        )}
      </section>

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
