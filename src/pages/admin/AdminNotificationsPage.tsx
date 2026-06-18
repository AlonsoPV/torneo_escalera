import { BarChart3, Scale } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  CompactEmpty,
  sortRowsForTab,
  tabFilterRows,
} from '@/components/admin/results/adminResultsReviewUtils'
import { AdminResultReviewRow } from '@/components/admin/results/AdminResultReviewRow'
import { AdminScoreCorrectionModal } from '@/components/admin/results/AdminScoreCorrectionModal'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  confirmResult,
  correctResult,
  getAdminDisputedResults,
  type AdminMatchRecord,
} from '@/services/admin'
import { adminValidateDisputedWithoutChanges } from '@/services/matches'
import { getTournamentRules } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { ScoreSet } from '@/types/database'

/** Bandeja ligera: todos los partidos `score_disputed`; filtros y métricas amplias están en Resultados. */
export function AdminNotificationsPage() {
  const qc = useQueryClient()
  const actorId = useAuthStore((s) => s.user?.id)
  const [editingMatch, setEditingMatch] = useState<AdminMatchRecord | null>(null)

  const resultsQ = useQuery({
    queryKey: ['admin-disputed-results'],
    queryFn: getAdminDisputedResults,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })
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
    await qc.invalidateQueries({ queryKey: ['admin-disputed-results'] })
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
      return correctResult(
        input.match,
        input.sets,
        actorId,
        input.closeAfter,
        input.adminNote,
        rulesForEditor.data ?? null,
      )
    },
    onSuccess: (updatedMatch, input) => {
      const nextMatch = { ...input.match, ...updatedMatch }
      patchMatchInAdminCaches(nextMatch)
      toast.success('Marcador corregido y validado')
      setEditingMatch(null)
      void refreshResults({ touchedMatch: nextMatch }).catch((error) => {
        console.warn('[admin-notifications] background refresh failed after score correction', error)
      })
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

  const loadingShell = resultsQ.isLoading

  return (
    <div id="page-admin-notifications" data-name="admin-notifications-page" className="space-y-4 pb-8">
      <section id="section-admin-notifications-header" data-name="notifications-page-header">
        <AdminPageHeader
          eyebrow="Administración"
          title="Disputas · revisión"
          description="Marcadores refutados por rivales. Aquí solo ves disputas pendientes; usa Resultados para filtrar por torneo, grupo o jugador."
          actions={
            <Link
              id="admin-notifications-link-matches"
              data-name="notifications-link-matches"
              to="/admin/matches?tab=disputed"
              className={cn(buttonVariants({ size: 'sm' }), 'gap-2 bg-[#1F5A4C] text-white hover:bg-[#174a3f]')}
            >
              <BarChart3 className="size-4 opacity-90" aria-hidden />
              Abrir Partidos (filtros)
            </Link>
          }
        />
      </section>

      <section
        id="section-admin-notifications-inbox"
        data-name="notifications-disputes-inbox"
        aria-labelledby="admin-notifications-inbox-heading"
        className="space-y-3"
      >
        <div
          id="admin-notifications-inbox-summary"
          data-name="notifications-inbox-summary"
          className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 via-white to-white p-4 shadow-sm ring-1 ring-amber-900/[0.04] sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <div
                id="admin-notifications-inbox-icon"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-900 shadow-inner shadow-amber-900/5"
                aria-hidden
              >
                <Scale className="size-5" strokeWidth={2.25} />
              </div>
              <div id="admin-notifications-inbox-copy" data-name="notifications-inbox-copy" className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="admin-notifications-inbox-heading"
                    data-name="notifications-inbox-heading"
                    className="text-base font-semibold tracking-tight text-[#102A43]"
                  >
                    Bandeja de revisión
                  </h2>
                  <Badge
                    id="admin-notifications-inbox-count"
                    data-name="notifications-dispute-count"
                    variant="secondary"
                    className="border-amber-200/90 bg-white/90 px-2 py-0 text-[11px] font-bold tabular-nums text-amber-950"
                  >
                    {loadingShell ? '…' : disputedCount}
                  </Badge>
                </div>
                <p
                  id="admin-notifications-inbox-description"
                  data-name="notifications-inbox-description"
                  className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm"
                >
                  Lista prioritaria de partidos en{' '}
                  <span className="font-medium text-slate-800">pendiente revisión administrativa</span>. Orden: más
                  recientes primero (última actualización).
                </p>
              </div>
            </div>
          </div>
        </div>

        {resultsQ.isError ? (
          <CompactEmpty
            id="admin-notifications-error"
            dataName="notifications-load-error"
            title={resultsQ.error instanceof Error ? resultsQ.error.message : 'No se pudieron cargar los datos.'}
          />
        ) : loadingShell ? (
          <Skeleton id="admin-notifications-loading" data-name="notifications-loading" className="h-[min(calc(100dvh-13rem),780px)] w-full rounded-2xl" />
        ) : disputedCount === 0 ? (
          <CompactEmpty
            id="admin-notifications-empty"
            dataName="notifications-empty-inbox"
            title="No hay disputas pendientes."
          />
        ) : (
          <div
            id="admin-notifications-disputes-list"
            data-name="notifications-disputes-list"
            className="max-h-[min(calc(100dvh-13rem),900px)] space-y-3 overflow-auto rounded-2xl border border-slate-200/95 bg-white/70 p-3 shadow-sm sm:p-4"
          >
            {disputedTabRows.map((match) => (
              <AdminResultReviewRow
                key={match.id}
                match={match}
                quickReview={false}
                validatePending={validateDisputedMut.isPending && validateDisputedMut.variables?.id === match.id}
                onConfirm={(m) => confirmMut.mutate(m)}
                onCorrect={(m) => setEditingMatch(m)}
                onValidateAsIs={(m) => validateDisputedMut.mutate(m)}
              />
            ))}
          </div>
        )}
      </section>

      <AdminScoreCorrectionModal
        match={editingMatch}
        rules={rulesForEditor.data ?? null}
        open={Boolean(editingMatch)}
        elementIdPrefix="admin-notifications-correction"
        title="Editar marcador"
        description="Corrige el marcador disputado y valídalo para cerrar la revisión."
        onOpenChange={(open) => {
          if (!open) setEditingMatch(null)
        }}
        onSubmit={(input) => correctMut.mutate(input)}
        submitPending={correctMut.isPending}
      />
    </div>
  )
}
