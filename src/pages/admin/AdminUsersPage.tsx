import { Search, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AdminConfirmDialog } from '@/components/admin/shared/AdminConfirmDialog'
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/shared/AdminDataTable'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { AdminStatusBadge } from '@/components/admin/shared/AdminStatusBadge'
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar'
import { ChangePasswordModal } from '@/components/admin/users/ChangePasswordModal'
import { CreateUserModal } from '@/components/admin/users/CreateUserModal'
import { EditUserModal } from '@/components/admin/users/EditUserModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  assignPlayerToGroup,
  changeUserPassword,
  createUser,
  deactivateUser,
  getAdminGroups,
  getAdminUsers,
  removePlayerFromGroup,
  updateUser,
  type AdminUserRecord,
} from '@/services/admin'
import type { UserRole } from '@/types/database'

export function AdminUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [groupFilter, setGroupFilter] = useState('all')

  const usersQ = useQuery({ queryKey: ['admin-users'], queryFn: getAdminUsers })
  const groupsQ = useQuery({ queryKey: ['admin-groups'], queryFn: () => getAdminGroups() })
  const groups = useMemo(() => groupsQ.data?.map((group) => ({ ...group })) ?? [], [groupsQ.data])

  const refreshUsers = async () => {
    await qc.invalidateQueries({ queryKey: ['admin-users'] })
    await qc.invalidateQueries({ queryKey: ['admin-groups'] })
  }

  const updateUserMut = useMutation({
    mutationFn: async (input: {
      user: AdminUserRecord
      fullName: string
      email: string
      role: UserRole
      groupId?: string
    }) => {
      await updateUser(input.user.id, {
        full_name: input.fullName || null,
        email: input.email || null,
        role: input.role,
      })
      if (input.user.groupPlayer && input.user.group?.id !== input.groupId) {
        await removePlayerFromGroup(input.user.groupPlayer.id)
      }
      if (input.groupId && input.user.group?.id !== input.groupId) {
        await assignPlayerToGroup({
          groupId: input.groupId,
          userId: input.user.id,
          displayName: input.fullName || input.email || 'Jugador',
        })
      }
    },
    onSuccess: async () => {
      toast.success('Usuario actualizado')
      await refreshUsers()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al actualizar usuario'),
  })

  const actionMut = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: async () => refreshUsers(),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Acción no disponible'),
  })

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return (usersQ.data ?? []).filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.full_name?.toLowerCase().includes(normalizedSearch) ||
        user.email?.toLowerCase().includes(normalizedSearch)
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesGroup = groupFilter === 'all' || user.group?.id === groupFilter
      return matchesSearch && matchesRole && matchesGroup
    })
  }, [groupFilter, roleFilter, search, usersQ.data])

  const columns: AdminDataTableColumn<AdminUserRecord>[] = [
    {
      key: 'name',
      header: 'Usuario',
      render: (user) => (
        <div>
          <p className="font-medium text-[#102A43]">{user.full_name ?? user.email ?? 'Sin nombre'}</p>
          <p className="text-xs text-[#64748B]">{user.email ?? 'Sin email'}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Rol', render: (user) => <AdminStatusBadge status={user.role} /> },
    { key: 'group', header: 'Grupo', render: (user) => user.group?.name ?? 'Sin grupo' },
    { key: 'created', header: 'Creado', render: (user) => user.created_at.slice(0, 10) },
    {
      key: 'actions',
      header: 'Acciones',
      render: (user) => (
        <div className="flex flex-wrap gap-2">
          <EditUserModal
            user={user}
            groups={groups}
            onSubmit={(values) => updateUserMut.mutate({ user, ...values })}
          />
          <ChangePasswordModal
            userId={user.id}
            onSubmit={(values) => actionMut.mutate(() => changeUserPassword(values))}
          />
          <AdminConfirmDialog
            title="¿Seguro que deseas eliminar este usuario?"
            description="Esta acción puede afectar partidos y rankings relacionados. Por ahora se preparará como desactivación segura."
            confirmLabel="Desactivar"
            onConfirm={() => actionMut.mutate(() => deactivateUser(user.id))}
            trigger={
              <Button variant="destructive" size="sm">
                <Trash2 className="size-3.5" />
                Eliminar
              </Button>
            }
          />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-8 sm:space-y-10">
      <AdminPageHeader
        eyebrow="Administración"
        title="Usuarios"
        description="Busca, filtra por rol o grupo, edita perfiles y gestiona acciones seguras (altas y contraseñas cuando estén disponibles)."
        actions={
          <CreateUserModal
            groups={groups}
            onSubmit={(values) => actionMut.mutate(() => createUser(values))}
          />
        }
      />

      <section className="space-y-4" aria-labelledby="users-toolbar-heading">
        <AdminSectionTitle
          id="users-toolbar-heading"
          title="Filtros"
          description="Encuentra personas rápido antes de editar o asignar a un grupo."
        />
        <AdminToolbar>
          <div className="relative w-full min-w-0 sm:max-w-md sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              className="h-11 pl-10"
              placeholder="Buscar por nombre o email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar usuarios"
            />
          </div>
          <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:flex sm:flex-1 sm:flex-wrap sm:gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-2 sm:min-w-[11rem]">
              <span className="text-xs font-medium text-slate-600">Rol</span>
              <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as UserRole | 'all')}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="player">Jugador</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super admin</SelectItem>
                  <SelectItem value="captain">Capitán</SelectItem>
                  <SelectItem value="referee">Árbitro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2 sm:min-w-[11rem]">
              <span className="text-xs font-medium text-slate-600">Grupo</span>
              <Select value={groupFilter} onValueChange={(value) => setGroupFilter(value ?? 'all')}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los grupos</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </AdminToolbar>
      </section>

      <section className="space-y-4" aria-labelledby="users-list-heading">
        <AdminSectionTitle id="users-list-heading" title="Listado" description="Tabla en pantallas medianas o mayores; tarjetas en móvil." />

      {usersQ.isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : filteredUsers.length === 0 ? (
        <AdminEmptyState
          title="No encontramos usuarios con esos filtros."
          description="Ajusta la búsqueda, rol o grupo para ver más resultados."
          icon={Users}
        />
      ) : (
        <>
          <div className="hidden md:block">
            <AdminDataTable rows={filteredUsers} columns={columns} getRowKey={(user) => user.id} />
          </div>
          <div className="grid gap-4 md:hidden">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#102A43]">{user.full_name ?? user.email}</p>
                      <p className="break-all text-xs text-[#64748B]">{user.email}</p>
                    </div>
                    <div className="shrink-0">
                      <AdminStatusBadge status={user.role} />
                    </div>
                  </div>
                  <p className="text-sm text-[#64748B]">Grupo: {user.group?.name ?? 'Sin grupo'}</p>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">{columns.at(-1)?.render(user)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
      </section>
    </div>
  )
}
