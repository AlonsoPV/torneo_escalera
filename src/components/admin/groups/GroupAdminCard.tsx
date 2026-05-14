import { Users } from 'lucide-react'

import { AdminConfirmDialog } from '@/components/admin/shared/AdminConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
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
  const complete = group.players.length >= group.max_players
  const canDeleteGroup = group.players.length === 0
  const status = getGroupStatus(group)
  const cupo = Math.max(1, group.max_players ?? 5)
  const pct = Math.min(100, (group.players.length / cupo) * 100)

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/20 bg-background p-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight text-foreground">{group.name}</p>
          {group.tournament?.name ? (
            <p className="text-xs text-muted-foreground">{group.tournament.name}</p>
          ) : null}
        </div>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Users className="size-3.5" aria-hidden />
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1">
        {complete ? (
          <Badge
            variant="outline"
            className="rounded-full border-emerald-200 bg-emerald-50 px-2 py-0 text-[11px] font-medium text-emerald-800"
          >
            Completo
          </Badge>
        ) : status === 'incomplete' ? (
          <Badge
            variant="outline"
            className="rounded-full border-amber-200 bg-amber-50 px-2 py-0 text-[11px] font-medium text-amber-900"
          >
            Incompleto
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="rounded-full border-border bg-muted/60 px-2 py-0 text-[11px] font-medium text-muted-foreground"
          >
            Sin jugadores
          </Badge>
        )}
        {generated ? (
          <Badge
            variant="outline"
            className="rounded-full border-sky-200 bg-sky-50 px-2 py-0 text-[11px] font-medium text-sky-900"
          >
            Cruces generados
          </Badge>
        ) : null}
        {group.category?.name ? (
          <Badge variant="secondary" className="rounded-full px-2 py-0 text-[11px] font-medium">
            {group.category.name}
          </Badge>
        ) : null}
      </div>

      {/* Barra de progreso */}
      <div className="h-1 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-green-700" style={{ width: `${pct}%` }} />
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>
          Jugadores{' '}
          <strong className="text-foreground">
            {group.players.length}/{cupo}
          </strong>
        </span>
        <span>
          Partidos{' '}
          <strong className="text-foreground">{group.matches.length}</strong>
        </span>
      </div>

      {/* Acciones texto */}
      <div className="flex items-center gap-2 border-t border-border/20 pt-1 text-xs">
        <button
          type="button"
          className="text-blue-600 hover:underline dark:text-blue-400"
          onClick={() => onManage(group)}
        >
          Gestionar
        </button>
        <span className="text-border" aria-hidden>
          ·
        </span>
        {onDelete ? (
          canDeleteGroup ? (
            <AdminConfirmDialog
              title="¿Eliminar este grupo?"
              description={`Se eliminará «${group.name}» del torneo y los ${group.matches.length} partidos vinculados (si los hay). No se puede deshacer.`}
              confirmLabel="Eliminar grupo"
              disabled={isDeleting}
              onConfirm={() => onDelete(group)}
              trigger={
                <button
                  type="button"
                  className={cn(
                    'text-muted-foreground hover:text-red-600 disabled:pointer-events-none disabled:opacity-50',
                  )}
                  disabled={isDeleting}
                  aria-label={`Eliminar grupo ${group.name}`}
                >
                  Eliminar
                </button>
              }
            />
          ) : (
            <button
              type="button"
              className="cursor-not-allowed text-muted-foreground/70"
              disabled
              title="Quita primero a todos los jugadores del grupo para poder eliminarlo."
            >
              Eliminar
            </button>
          )
        ) : null}
      </div>
      {onDelete && !canDeleteGroup ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Quita a los jugadores en «Gestionar» para habilitar eliminar.
        </p>
      ) : null}
    </div>
  )
}
