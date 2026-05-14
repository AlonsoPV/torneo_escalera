import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UserRound } from 'lucide-react'

import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { EditUserModal } from '@/components/admin/users/EditUserModal'
import { Card, CardContent } from '@/components/ui/card'
import { formatRecoveryEmailDisplay } from '@/lib/profileEmail'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdminUserRecord } from '@/services/admin'
import { listPlayerCategories } from '@/services/playerCategories'
import type { Group, UserRole } from '@/types/database'

type Props = {
  users: AdminUserRecord[]
  groups: Group[]
  isLoading: boolean
  onUpdateUser: (input: {
    user: AdminUserRecord
    fullName: string
    role: UserRole
    categoryId: string
    groupId?: string
  }) => void
}

export function AvailablePlayersPoolSection({ users, groups, isLoading, onUpdateUser }: Props) {
  const categoriesQ = useQuery({
    queryKey: ['player-categories'],
    queryFn: listPlayerCategories,
  })

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categoriesQ.data ?? []) {
      m.set(c.id, c.name)
    }
    return m
  }, [categoriesQ.data])

  const pool = useMemo(
    () =>
      users.filter(
        (u) => u.role === 'player' && !u.group && u.status === 'active',
      ),
    [users],
  )

  if (isLoading) {
    return (
      <section className="space-y-4" aria-labelledby="pool-heading">
        <AdminSectionTitle
          id="pool-heading"
          title="Jugadores disponibles"
          description="Jugadores activos sin grupo. Asígnalos manualmente desde aquí o desde la página de grupos."
        />
        <Card className="rounded-2xl border border-slate-200/80">
          <CardContent className="p-6 text-sm text-slate-600">Cargando…</CardContent>
        </Card>
      </section>
    )
  }

  if (pool.length === 0) {
    return (
      <section className="space-y-4" aria-labelledby="pool-heading">
        <AdminSectionTitle
          id="pool-heading"
          title="Jugadores disponibles"
          description="Jugadores activos sin grupo. Tras una carga masiva, aparecerán aquí hasta que los asignes a un grupo del torneo."
        />
        <AdminEmptyState
          title="No hay jugadores en el pool"
          description="Todos los jugadores tienen grupo asignado, o aún no has importado usuarios sin grupo."
          icon={UserRound}
        />
      </section>
    )
  }

  return (
    <section className="space-y-4" aria-labelledby="pool-heading">
      <AdminSectionTitle
        id="pool-heading"
        title="Jugadores disponibles"
        description="Estado: sin grupo. La categoría (Varonil, Femenil, etc.) viene del perfil; el grupo lo eliges al organizar el torneo."
      />

      <Card className="rounded-2xl border border-slate-200/80">
        <CardContent className="p-0 sm:p-0">
          <div className="max-h-[24rem] overflow-auto rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jugador</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[7rem]"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pool.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-[#102A43]">{user.full_name ?? user.phone ?? '—'}</p>
                        <p className="text-xs text-slate-500 tabular-nums">{user.phone ?? '—'}</p>
                        <p className="text-xs text-slate-400">{formatRecoveryEmailDisplay(user.email)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#64748B]">
                      {user.external_id ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">
                      {user.category_id ? categoryNameById.get(user.category_id) ?? '—' : 'Sin categoría'}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        Sin grupo
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <EditUserModal
                        user={user}
                        groups={groups}
                        categories={categoriesQ.data ?? []}
                        onSubmit={(values) => onUpdateUser({ user, ...values })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-600">
        Este listado solo incluye jugadores con rol <strong>player</strong> activos y sin fila en ningún grupo.
      </p>
    </section>
  )
}
