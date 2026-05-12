import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Grid3x3, Info, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { AdminConfirmDialog } from '@/components/admin/shared/AdminConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  const inT = groups.filter((g) => g.tournament_id === tournamentId)
  let eligible = 0
  let complete = 0
  for (const g of inT) {
    const n = g.players.length
    const cap = g.max_players ?? 5
    if (n >= 2 && n <= 5) {
      eligible += 1
      if (n >= cap) complete += 1
    }
  }
  return { eligible, complete, totalInTournament: inT.length }
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
  /** `admin` = estilo panel admin; `embed` = neutro para ficha del torneo */
  variant?: 'admin' | 'embed'
}) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<GenerateRrMode>('fill')
  const [scope, setScope] = useState<GenerateRrTournamentScope>('complete_groups_only')

  const counts = useMemo(() => countTargetGroups(groups, tournamentId), [groups, tournamentId])

  const approximateRun = useMemo(() => {
    const inT = groups.filter((g) => g.tournament_id === tournamentId)
    let willRun = 0
    for (const g of inT) {
      const n = g.players.length
      const cap = g.max_players ?? 5
      if (n < 2 || n > 5) continue
      if (scope === 'complete_groups_only' && n < cap) continue
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
        groups: groups.map((g) => ({
          id: g.id,
          name: g.name,
          tournament_id: g.tournament_id,
          max_players: g.max_players,
          players: g.players.map((p) => ({
            id: p.id,
            user_id: p.user_id,
            group_id: p.group_id,
            display_name: p.display_name,
            seed_order: p.seed_order,
            created_at: p.created_at,
          })),
        })),
      }),
    onSuccess: async (results) => {
      const generated = results.filter((r) => r.outcome === 'generated').length
      const skipped = results.filter((r) => r.outcome === 'skipped').length
      toast.success(`Listo: ${generated} grupo(s) con cruces actualizados. ${skipped} omitido(s).`)
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

  const cardClass =
    variant === 'admin'
      ? 'border-[#E2E8F0] bg-white shadow-sm'
      : 'border-border/80 bg-card shadow-sm'

  const runButton = (
    <Button
      type="button"
      className="w-full gap-2 bg-[#1F5A4C] hover:bg-[#1F5A4C]/90 sm:w-auto"
      disabled={disabled || !currentUserId || approximateRun === 0 || bulkMut.isPending}
      onClick={() => bulkMut.mutate()}
    >
      {bulkMut.isPending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Generando…
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
    <Card className={cn('rounded-2xl', cardClass)}>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base text-[#102A43]">
          <Grid3x3 className="size-5 text-[#1F5A4C]" />
          Distribución de cruces (todo el torneo)
        </CardTitle>
        <CardDescription className="text-pretty text-sm">
          Aplica round-robin a cada grupo según el cupo <code className="rounded bg-slate-100 px-1 text-xs">max_players</code> y
          los jugadores ya inscritos (orden por <code className="rounded bg-slate-100 px-1 text-xs">seed</code>). Máximo 5
          jugadores por grupo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2 text-xs text-sky-950">
          <p className="flex gap-2">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              En este torneo hay {counts.totalInTournament} grupo(s). Con el alcance elegido se procesarán aprox.{' '}
              <strong>{approximateRun}</strong> grupo(s) ({counts.eligible} con 2–5 jugadores; {counts.complete} al cupo
              completo).
            </span>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-slate-700">Modo</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as GenerateRrMode)}>
              <SelectTrigger className="border-slate-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fill">Solo cruces faltantes (no borra existentes)</SelectItem>
                <SelectItem value="reset">Regenerar (elimina partidos del grupo y recrea cruces)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700">Alcance</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as GenerateRrTournamentScope)}>
              <SelectTrigger className="border-slate-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="complete_groups_only">Solo grupos completos (jugadores = cupo)</SelectItem>
                <SelectItem value="all_eligible">Todos los grupos con 2–5 jugadores</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {mode === 'reset' ? (
            <AdminConfirmDialog
              title="¿Regenerar cruces en todos los grupos elegidos?"
              description="Se eliminarán los partidos existentes de esos grupos y se volverán a crear los emparejamientos round-robin. Los marcadores capturados se perderán en esos grupos."
              confirmLabel="Sí, regenerar"
              disabled={bulkMut.isPending || !currentUserId || approximateRun === 0}
              onConfirm={() => bulkMut.mutate()}
              trigger={
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full gap-2 sm:w-auto"
                  disabled={disabled || !currentUserId || approximateRun === 0 || bulkMut.isPending}
                >
                  {bulkMut.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generando…
                    </>
                  ) : (
                    <>
                      <Grid3x3 className="size-4" />
                      Regenerar cruces en {approximateRun} grupo(s)
                    </>
                  )}
                </Button>
              }
            />
          ) : (
            runButton
          )}
        </div>
      </CardContent>
    </Card>
  )
}
