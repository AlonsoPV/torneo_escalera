import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Grid3x3, Loader2, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { AdminConfirmDialog } from '@/components/admin/shared/AdminConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { AdminGroupRecord } from '@/services/admin'
import {
  generateRoundRobinForTournamentGroups,
  type GenerateRrMode,
  type GenerateRrTournamentScope,
} from '@/services/matches'

function countTargetGroups(
  groups: AdminGroupRecord[],
  tournamentId: string,
): { eligible: number; complete: number; totalInTournament: number } {
  const inTournament = groups.filter((g) => g.tournament_id === tournamentId)
  let eligible = 0
  let complete = 0

  for (const group of inTournament) {
    const playerCount = group.players.length
    const cap = group.max_players ?? 5
    if (playerCount >= 2 && playerCount <= 5) {
      eligible += 1
      if (playerCount >= cap) complete += 1
    }
  }

  return { eligible, complete, totalInTournament: inTournament.length }
}

export function TournamentRoundRobinBulkCard({
  tournamentId,
  groups,
  currentUserId,
  disabled,
  variant = 'admin',
}: {
  tournamentId: string
  groups: AdminGroupRecord[]
  currentUserId: string | null
  disabled?: boolean
  variant?: 'admin' | 'embed'
}) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<GenerateRrMode>('fill')
  const [scope, setScope] = useState<GenerateRrTournamentScope>('complete_groups_only')

  const counts = useMemo(() => countTargetGroups(groups, tournamentId), [groups, tournamentId])
  const modeLabel = mode === 'fill' ? 'Solo cruces faltantes' : 'Regenerar cruces'
  const scopeLabel =
    scope === 'complete_groups_only' ? 'Solo grupos completos' : 'Todos los grupos elegibles'

  const approximateRun = useMemo(() => {
    const inTournament = groups.filter((g) => g.tournament_id === tournamentId)
    let willRun = 0
    for (const group of inTournament) {
      const playerCount = group.players.length
      const cap = group.max_players ?? 5
      if (playerCount < 2 || playerCount > 5) continue
      if (scope === 'complete_groups_only' && playerCount < cap) continue
      willRun += 1
    }
    return willRun
  }, [groups, tournamentId, scope])

  const bulkMut = useMutation({
    mutationFn: () =>
      generateRoundRobinForTournamentGroups({
        tournamentId,
        mode,
        scope,
        createdBy: currentUserId,
        groups: groups.map((group) => ({
          id: group.id,
          name: group.name,
          tournament_id: group.tournament_id,
          max_players: group.max_players,
          players: group.players.map((player) => ({
            id: player.id,
            user_id: player.user_id,
            group_id: player.group_id,
            display_name: player.display_name,
            seed_order: player.seed_order,
            created_at: player.created_at,
          })),
        })),
      }),
    onSuccess: async (results) => {
      const generated = results.filter((r) => r.outcome === 'generated').length
      const skipped = results.filter((r) => r.outcome === 'skipped').length
      const inserted = results.reduce((sum, r) => sum + (r.matchesInserted ?? 0), 0)
      toast.success(
        inserted > 0
          ? `Listo: ${generated} grupo(s) actualizados (${inserted} partido(s) nuevo(s)). ${skipped} omitido(s).`
          : `Listo: ${generated} grupo(s) procesados (sin partidos nuevos: ya existían o alcance vacío). ${skipped} omitido(s).`,
      )
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-groups'] }),
        qc.invalidateQueries({ queryKey: ['admin-matches'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
        qc.invalidateQueries({ queryKey: ['admin-results'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard'] }),
        qc.invalidateQueries({ queryKey: ['matches'] }),
        qc.invalidateQueries({ queryKey: ['groups', tournamentId] }),
        qc.invalidateQueries({ queryKey: ['tournament', tournamentId] }),
      ])
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Error al generar cruces'),
  })

  const cardClass = variant === 'admin' ? 'border-[#D7E2DD] bg-white' : 'border-border/80 bg-card'

  const runDisabled = disabled || !currentUserId || approximateRun === 0 || bulkMut.isPending
  const runButton = (
    <Button
      type="button"
      className="w-full gap-2 bg-[#1F5A4C] hover:bg-[#174a3f] sm:w-auto"
      disabled={runDisabled}
      onClick={() => bulkMut.mutate()}
    >
      {bulkMut.isPending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Generando...
        </>
      ) : (
        <>
          <Grid3x3 className="size-4" />
          Generar cruces en {approximateRun} grupo(s)
        </>
      )}
    </Button>
  )

  return (
    <Card className={cn('overflow-hidden rounded-2xl border shadow-sm', cardClass)}>
      <CardHeader className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E7F4EE] text-[#1F5A4C]">
              <Grid3x3 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base text-[#102A43]">Distribución de cruces</CardTitle>
              <CardDescription className="mt-1 max-w-3xl text-pretty text-sm leading-relaxed">
                Genera o completa partidos round-robin para los grupos elegibles del torneo. Mismo criterio técnico que
                el botón «Crear grupos y partidos» del bloque de jugadores libres (modo sólo faltantes aquí en un paso).
              </CardDescription>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:min-w-[21rem]">
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Grupos</p>
              <p className="font-mono text-lg font-bold text-[#102A43]">{counts.totalInTournament}</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Elegibles</p>
              <p className="font-mono text-lg font-bold text-[#102A43]">{counts.eligible}</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Procesa</p>
              <p className="font-mono text-lg font-bold text-[#102A43]">{approximateRun}</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <label htmlFor="bulk-rr-mode" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
              Modo
            </label>
            <Select value={mode} onValueChange={(v) => setMode(v as GenerateRrMode)}>
              <SelectTrigger id="bulk-rr-mode" className="h-10 min-w-[180px] w-full border-[#CBD5E1] bg-background">
                <span className="min-w-0 flex-1 truncate text-left">{modeLabel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fill" label="Solo cruces faltantes (no borra existentes)">
                  Solo cruces faltantes (no borra existentes)
                </SelectItem>
                <SelectItem value="reset" label="Regenerar (elimina partidos y recrea cruces)">
                  Regenerar (elimina partidos y recrea cruces)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <label htmlFor="bulk-rr-scope" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
              Alcance
            </label>
            <Select value={scope} onValueChange={(v) => setScope(v as GenerateRrTournamentScope)}>
              <SelectTrigger id="bulk-rr-scope" className="h-10 min-w-[180px] w-full border-[#CBD5E1] bg-background">
                <span className="min-w-0 flex-1 truncate text-left">{scopeLabel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="complete_groups_only" label="Solo grupos completos (jugadores = cupo)">
                  Solo grupos completos (jugadores = cupo)
                </SelectItem>
                <SelectItem value="all_eligible" label="Todos los grupos con 2 a 5 jugadores">
                  Todos los grupos con 2 a 5 jugadores
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border border-[#D7E2DD] bg-[#F8FAFC] px-3 py-2.5 text-xs leading-relaxed text-[#475569]">
          Con el alcance actual se procesarán <strong>{approximateRun}</strong> grupo(s). Hay{' '}
          <strong>{counts.complete}</strong> grupo(s) completos al cupo y <strong>{counts.eligible}</strong> grupo(s) con
          2 a 5 jugadores.
        </div>

        <div className="flex flex-col gap-3 border-t border-[#E2E8F0] pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {mode === 'reset' ? (
            <AdminConfirmDialog
              title="Regenerar cruces en los grupos elegidos"
              description="Se eliminarán los partidos existentes de esos grupos y se volverán a crear los emparejamientos round-robin. Los marcadores capturados se perderán en esos grupos."
              confirmLabel="Sí, regenerar"
              disabled={bulkMut.isPending || !currentUserId || approximateRun === 0}
              onConfirm={() => bulkMut.mutate()}
              trigger={
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full gap-2 sm:w-auto"
                  disabled={runDisabled}
                >
                  {bulkMut.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-4" />
                      Regenerar cruces en {approximateRun} grupo(s)
                    </>
                  )}
                </Button>
              }
            />
          ) : (
            runButton
          )}
          {!currentUserId ? (
            <p className="text-xs text-[#64748B]">Inicia sesión como admin para generar cruces.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
