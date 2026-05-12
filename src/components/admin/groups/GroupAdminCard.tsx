import { Trash2, Users } from 'lucide-react'

import { AdminConfirmDialog } from '@/components/admin/shared/AdminConfirmDialog'
import { AdminStatusBadge } from '@/components/admin/shared/AdminStatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminGroupRecord } from '@/services/admin'

function getGroupStatus(group: AdminGroupRecord) {
  if (group.players.length === 0) return 'empty'
  if (group.players.length >= group.max_players) return 'complete'
  return 'incomplete'
}

export function GroupAdminCard({
  group,
  onManage,
  onDelete,
  isDeleting = false,
}: {
  group: AdminGroupRecord
  onManage: (group: AdminGroupRecord) => void
  onDelete?: (group: AdminGroupRecord) => void
  isDeleting?: boolean
}) {
  const generated = group.matches.length > 0
  const canDeleteGroup = group.players.length === 0

  return (
    <Card className="border-[#E2E8F0] bg-white shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pr-2">
            <CardTitle className="text-balance text-lg text-[#102A43]">{group.name}</CardTitle>
            {group.tournament?.name ? (
              <p className="mt-1 text-sm text-[#64748B]">{group.tournament.name}</p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-2xl bg-[#F6F3EE] p-3 text-[#1F5A4C]">
            <Users className="size-5" />
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminStatusBadge status={getGroupStatus(group)} />
          {generated ? <AdminStatusBadge status="matches_generated" /> : null}
          {group.category?.name ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-[#475569]">
              {group.category.name}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-[#64748B]">Jugadores</span>
            <span className="font-medium text-[#102A43]">
              {group.players.length} / {group.max_players}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#1F5A4C]"
              style={{ width: `${Math.min(100, (group.players.length / group.max_players) * 100)}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#64748B]">Partidos</span>
          <span className="font-medium text-[#102A43]">{group.matches.length}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <Button variant="outline" className="w-full sm:flex-1" onClick={() => onManage(group)}>
            Gestionar grupo
          </Button>
          {onDelete ? (
            canDeleteGroup ? (
              <AdminConfirmDialog
                title="¿Eliminar este grupo?"
                description={`Se eliminará «${group.name}» del torneo y los ${group.matches.length} partidos vinculados (si los hay). No se puede deshacer.`}
                confirmLabel="Eliminar grupo"
                disabled={isDeleting}
                onConfirm={() => onDelete(group)}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-red-200 text-red-800 hover:bg-red-50 sm:w-auto sm:flex-initial"
                    aria-label={`Eliminar grupo ${group.name}`}
                    disabled={isDeleting}
                  >
                    <Trash2 className="size-4 shrink-0" aria-hidden />
                    Eliminar
                  </Button>
                }
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 border-slate-200 text-slate-400 sm:w-auto"
                disabled
                title="Quita primero a todos los jugadores del grupo para poder eliminarlo."
                aria-label="Eliminar grupo no disponible: hay jugadores inscritos"
              >
                <Trash2 className="size-4 shrink-0" aria-hidden />
                Eliminar
              </Button>
            )
          ) : null}
        </div>
        {onDelete && !canDeleteGroup ? (
          <p className="text-center text-xs text-[#64748B]">
            Para eliminar el grupo, primero quita a los {group.players.length} jugador{group.players.length === 1 ? '' : 'es'} en «Gestionar grupo».
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
