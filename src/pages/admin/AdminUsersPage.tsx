import {
  ChevronDown,
  FileSpreadsheet,
  KeyRound,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AdminConfirmDialog } from '@/components/admin/shared/AdminConfirmDialog'
import {
  AdminDataTable,
  ADMIN_TABLE_ROW_CHECKBOX_CLASS,
  type AdminDataTableColumn,
} from '@/components/admin/shared/AdminDataTable'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { AdminStatusBadge } from '@/components/admin/shared/AdminStatusBadge'
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar'
import { ChangePasswordModal } from '@/components/admin/users/ChangePasswordModal'
import { CreateUserModal } from '@/components/admin/users/CreateUserModal'
import { EditUserModal } from '@/components/admin/users/EditUserModal'
import { AvailablePlayersPoolSection } from '@/components/admin/users/AvailablePlayersPoolSection'
import { UserBulkImportSection } from '@/components/admin/users/UserBulkImportSection'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadCredencialesExcel } from '@/lib/export-credenciales'
import { formatRecoveryEmailDisplay, recoveryEmailComplete } from '@/lib/profileEmail'
import { ADMIN_USER_FILTER_ROLES, userRoleLabelEs } from '@/lib/permissions'
import { cn } from '@/lib/utils'
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
import { listPlayerCategories } from '@/services/playerCategories'
import { useAuthStore } from '@/stores/authStore'
import type { UserRole } from '@/types/database'

const PAGE_SIZE = 10

function splitFullName(full: string | null | undefined): { nombre: string; apellido: string } {
  const t = full?.trim() ?? ''
  if (!t) return { nombre: '', apellido: '' }
  const parts = t.split(/\s+/)
  return { nombre: parts[0] ?? '', apellido: parts.slice(1).join(' ') }
}

function correoOUsuarioExport(user: AdminUserRecord): string {
  const shown = formatRecoveryEmailDisplay(user.email)
  if (shown !== 'Sin correo') return shown
  if (user.phone) return `${user.phone} (acceso por celular)`
  return '—'
}

export function AdminUsersPage() {
  const qc = useQueryClient()
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')
  const [estadoFilter, setEstadoFilter] = useState<'all' | 'pendiente' | 'activo'>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)

  const usersQ = useQuery({ queryKey: ['admin-users'], queryFn: getAdminUsers })
  const groupsQ = useQuery({ queryKey: ['admin-groups'], queryFn: () => getAdminGroups() })
  const categoriesQ = useQuery({ queryKey: ['player-categories'], queryFn: listPlayerCategories })
  const groups = useMemo(() => groupsQ.data?.map((group) => ({ ...group })) ?? [], [groupsQ.data])
  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data])

  const refreshUsers = async () => {
    await qc.invalidateQueries({ queryKey: ['admin-users'] })
    await qc.invalidateQueries({ queryKey: ['admin-groups'] })
  }

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, roleFilter, groupFilter, categoryFilter, estadoFilter])

  const updateUserMut = useMutation({
    mutationFn: async (input: {
      user: AdminUserRecord
      fullName: string
      role: UserRole
      categoryId: string
      groupId?: string
    }) => {
      await updateUser(input.user.id, {
        full_name: input.fullName || null,
        role: input.role,
        category_id: input.categoryId || null,
      })
      if (input.user.groupPlayer && input.user.group?.id !== input.groupId) {
        await removePlayerFromGroup(input.user.groupPlayer.id)
      }
      if (input.groupId && input.user.group?.id !== input.groupId) {
        await assignPlayerToGroup({
          groupId: input.groupId,
          userId: input.user.id,
          displayName: input.fullName || input.user.phone || 'Jugador',
        })
      }
    },
    onSuccess: async () => {
      toast.success('Usuario actualizado')
      setEditModalOpen(false)
      await refreshUsers()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al actualizar usuario'),
  })

  const actionMut = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: async () => refreshUsers(),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Acción no disponible'),
  })

  const stats = useMemo(() => {
    const all = usersQ.data ?? []
    return {
      total: all.length,
      jugadores: all.filter((u) => u.role === 'player').length,
      sinCategoria: all.filter((u) => !u.category_id).length,
      sinGrupo: all.filter((u) => !u.group).length,
    }
  }, [usersQ.data])

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return (usersQ.data ?? []).filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.full_name?.toLowerCase().includes(normalizedSearch) ||
        user.phone?.toLowerCase().includes(normalizedSearch) ||
        formatRecoveryEmailDisplay(user.email).toLowerCase().includes(normalizedSearch)
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesGroup = groupFilter === 'all' || user.group?.id === groupFilter
      const matchesCategory = categoryFilter === 'all' || user.category_id === categoryFilter
      const matchesEstado =
        estadoFilter === 'all' ||
        (estadoFilter === 'pendiente' && !recoveryEmailComplete(user)) ||
        (estadoFilter === 'activo' && user.status === 'active')
      return matchesSearch && matchesRole && matchesGroup && matchesCategory && matchesEstado
    })
  }, [categoryFilter, estadoFilter, groupFilter, roleFilter, search, usersQ.data])

  useEffect(() => {
    setSelectedIds((prev) => {
      const allowed = new Set(filteredUsers.map((u) => u.id))
      const next = new Set<string>()
      for (const id of prev) {
        if (allowed.has(id)) next.add(id)
      }
      return next
    })
  }, [filteredUsers])

  const visibleUsers = useMemo(() => filteredUsers.slice(0, visibleCount), [filteredUsers, visibleCount])
  const hayMas = visibleCount < filteredUsers.length
  const totalOcultos = filteredUsers.length - visibleCount

  const selectedUsers = useMemo(
    () => filteredUsers.filter((u) => selectedIds.has(u.id)),
    [filteredUsers, selectedIds],
  )

  const toggleSelectionRow = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleSelectionAllVisible = (select: boolean) => {
    const keys = visibleUsers.map((u) => u.id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (select) keys.forEach((id) => next.add(id))
      else keys.forEach((id) => next.delete(id))
      return next
    })
  }

  const allVisibleSelected =
    visibleUsers.length > 0 && visibleUsers.every((u) => selectedIds.has(u.id))

  const deactivateTargets = useMemo(
    () =>
      selectedUsers.filter(
        (u) => u.status === 'active' && (currentUserId === null || u.id !== currentUserId),
      ),
    [selectedUsers, currentUserId],
  )

  const reactivateTargets = useMemo(
    () => selectedUsers.filter((u) => u.status === 'inactive'),
    [selectedUsers],
  )

  const soleSelectedUser = selectedUsers.length === 1 ? selectedUsers[0] : undefined

  useEffect(() => {
    if (selectedUsers.length !== 1) {
      setEditModalOpen(false)
      setPasswordModalOpen(false)
    }
  }, [selectedUsers.length])

  const usersToCredencialRows = (users: AdminUserRecord[]) =>
    users.map((u) => {
      const { nombre, apellido } = splitFullName(u.full_name)
      const cat = categories.find((c) => c.id === u.category_id)
      return {
        nombre,
        apellido,
        correo: correoOUsuarioExport(u),
        contrasena_temporal: '—',
        rol: userRoleLabelEs(u.role),
        categoria: cat?.name ?? '—',
        grupo: u.group?.name ?? '—',
        celular: u.phone ?? '',
      }
    })

  const handleDescargarCredenciales = () => {
    if (!filteredUsers.length) {
      toast.message('No hay usuarios que coincidan con los filtros actuales.')
      return
    }
    downloadCredencialesExcel(usersToCredencialRows(filteredUsers))
    toast.success('Archivo Excel generado')
  }

  const handleExportSelectedCredenciales = () => {
    if (!selectedUsers.length) {
      toast.message('Selecciona al menos un usuario para exportar.')
      return
    }
    downloadCredencialesExcel(usersToCredencialRows(selectedUsers))
    toast.success('Excel generado con la selección')
  }

  const columns: AdminDataTableColumn<AdminUserRecord>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (user) => (
        <span className="text-xs font-medium leading-tight text-[#102A43]">{user.full_name ?? 'Sin nombre'}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Celular',
      render: (user) => (
        <span className="tabular-nums text-xs leading-tight text-[#334E68]">{user.phone ?? '—'}</span>
      ),
    },
    {
      key: 'recovery',
      header: 'Correo recuperación',
      render: (user) => (
        <span className="max-w-[14rem] truncate text-xs leading-tight text-[#334E68]" title={formatRecoveryEmailDisplay(user.email)}>
          {formatRecoveryEmailDisplay(user.email)}
        </span>
      ),
    },
    {
      key: 'recovery_status',
      header: 'Recuperación',
      headerTitle:
        'Indica si ya registró un correo para recuperar contraseña. No confundir con la columna «Cuenta» (activo/desactivado por admin).',
      render: (user) =>
        recoveryEmailComplete(user) ? (
          <Badge
            variant="secondary"
            className="h-5 border-emerald-200/80 bg-emerald-50 px-1.5 text-[10px] font-medium leading-none text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
          >
            Listo
          </Badge>
        ) : (
          <Badge
            variant="secondary"
            className="h-5 border-amber-200/90 bg-amber-50 px-1.5 text-[10px] font-medium leading-none text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          >
            Falta correo
          </Badge>
        ),
    },
    {
      key: 'group',
      header: 'Grupo',
      render: (user) => (
        <span className="max-w-[10rem] truncate text-xs leading-tight" title={user.group?.name ?? 'Sin grupo'}>
          {user.group?.name ?? 'Sin grupo'}
        </span>
      ),
    },
    {
      key: 'account',
      header: 'Cuenta',
      headerTitle: 'Cuenta activa o desactivada por un administrador (no puede iniciar sesión si está desactivada).',
      render: (user) => (
        <AdminStatusBadge
          status={user.status === 'inactive' ? 'inactive' : 'active'}
          className="h-5 shrink-0 rounded-md px-1.5 py-0 text-[10px] font-medium leading-none"
        />
      ),
    },
  ]

  const loadMoreFooter =
    hayMas && filteredUsers.length > 0 ? (
      <TableRow className="border-0 hover:bg-transparent">
        <TableCell colSpan={columns.length + 1} className="py-2 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="mx-auto inline-flex items-center gap-2 rounded-lg border border-border/30 px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted/50"
          >
            <ChevronDown size={14} aria-hidden />
            Ver {Math.min(PAGE_SIZE, totalOcultos)} más
            <span className="text-xs text-muted-foreground/60">({totalOcultos} restantes)</span>
          </button>
        </TableCell>
      </TableRow>
    ) : null

  return (
    <div className="space-y-8 sm:space-y-10">
      <AdminPageHeader
        eyebrow="Administración"
        title="Usuarios"
        description="Busca, filtra por rol o grupo, edita perfiles y gestiona acciones seguras (altas y contraseñas cuando estén disponibles)."
        actions={
          <CreateUserModal
            groups={groups}
            categories={categories}
            onSubmit={(values) =>
              actionMut.mutate(async () => {
                await createUser(values)
                toast.success('Usuario creado')
              })
            }
          />
        }
      />

      <UserBulkImportSection />

      <AvailablePlayersPoolSection
        users={usersQ.data ?? []}
        groups={groups}
        isLoading={usersQ.isLoading}
        onUpdateUser={(input) => updateUserMut.mutate(input)}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: 'Total usuarios', value: stats.total },
          { label: 'Jugadores', value: stats.jugadores },
          { label: 'Sin categoría', value: stats.sinCategoria },
          { label: 'Sin grupo', value: stats.sinGrupo },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-muted/50 p-3">
            <p className="mb-1 text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-medium tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-green-900">Descargar credenciales</p>
          <p className="mt-0.5 text-xs text-green-700">
            Exporta nombre, correo o celular de acceso, rol, categoría y grupo según los filtros actuales. Las contraseñas no se almacenan; usa “Cambiar contraseña” para fijar una nueva y comunícala aparte.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleDescargarCredenciales}
          className="shrink-0 gap-2 bg-green-800 text-white hover:bg-green-900"
          size="sm"
        >
          <FileSpreadsheet className="size-3.5" aria-hidden />
          Descargar Excel
        </Button>
      </div>

      <section className="space-y-4" aria-labelledby="users-toolbar-heading">
        <AdminSectionTitle
          id="users-toolbar-heading"
          title="Filtros"
          description="Encuentra personas rápido antes de editar o asignar a un grupo."
        />
        <AdminToolbar className="flex-wrap gap-3 sm:items-center">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="h-11 pl-9"
              placeholder="Buscar por nombre, celular o correo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar usuarios"
            />
          </div>
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as UserRole | 'all')}>
            <SelectTrigger className="h-11 min-w-[140px] w-[min(100%,11rem)]">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="Todos los roles">
                Rol: todos
              </SelectItem>
              {ADMIN_USER_FILTER_ROLES.map((r) => (
                <SelectItem key={r} value={r} label={userRoleLabelEs(r)}>
                  {userRoleLabelEs(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value ?? 'all')}>
            <SelectTrigger className="h-11 min-w-[150px] w-[min(100%,12rem)]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="Todas las categorías">
                Categoría: todas
              </SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id} label={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={estadoFilter} onValueChange={(value) => setEstadoFilter(value as 'all' | 'pendiente' | 'activo')}>
            <SelectTrigger className="h-11 min-w-[140px] w-[min(100%,11rem)]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="Todos">
                Estado: todos
              </SelectItem>
              <SelectItem value="pendiente" label="Sin correo de recuperación">
                Sin correo de recuperación
              </SelectItem>
              <SelectItem value="activo" label="Cuenta activa">
                Cuenta activa
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupFilter} onValueChange={(value) => setGroupFilter(value ?? 'all')}>
            <SelectTrigger className="h-11 min-w-[160px] w-[min(100%,13rem)]">
              <SelectValue placeholder="Grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="Todos los grupos">
                Grupo: todos
              </SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id} label={group.name}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </AdminToolbar>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleDescargarCredenciales}
            className="inline-flex items-center gap-2 rounded-lg border border-border/30 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
          >
            <FileSpreadsheet size={13} aria-hidden />
            Exportar credenciales (.xlsx)
          </button>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="users-list-heading">
        <AdminSectionTitle
          id="users-list-heading"
          title="Listado"
          description="Marca filas con la casilla y usa la barra de acciones. «Recuperación» = correo para reset. «Cuenta» = alta o baja por administrador."
        />

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
            <div
              role="toolbar"
              aria-label="Acciones sobre usuarios seleccionados"
              className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/25 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {selectedIds.size === 0
                    ? 'Selecciona una o más filas para editar, cambiar contraseña o aplicar acciones en bloque.'
                    : `${selectedIds.size} seleccionado(s)`}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => toggleSelectionAllVisible(!allVisibleSelected)}
                  disabled={!visibleUsers.length}
                >
                  {allVisibleSelected ? 'Quitar visibles' : 'Seleccionar visibles'}
                </Button>
                {selectedIds.size > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Limpiar selección
                  </Button>
                ) : null}
              </div>
              {selectedIds.size > 0 ? (
                <div className="flex flex-wrap gap-2 border-t border-border/30 pt-3 sm:border-t-0 sm:pt-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    disabled={soleSelectedUser === undefined}
                    onClick={() => soleSelectedUser && setEditModalOpen(true)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    disabled={soleSelectedUser === undefined}
                    onClick={() => soleSelectedUser && setPasswordModalOpen(true)}
                  >
                    <KeyRound className="size-3.5" aria-hidden />
                    Contraseña
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={handleExportSelectedCredenciales}
                  >
                    <FileSpreadsheet className="size-3.5" aria-hidden />
                    Excel selección
                  </Button>
                  <AdminConfirmDialog
                    title={
                      reactivateTargets.length === 1
                        ? '¿Reactivar esta cuenta?'
                        : `¿Reactivar ${reactivateTargets.length} cuentas?`
                    }
                    description="Las cuentas seleccionadas podrán volver a iniciar sesión."
                    confirmLabel="Reactivar"
                    disabled={reactivateTargets.length === 0 || actionMut.isPending}
                    onConfirm={() =>
                      actionMut.mutate(async () => {
                        for (const u of reactivateTargets) {
                          await updateUser(u.id, { status: 'active' })
                        }
                        toast.success(
                          reactivateTargets.length === 1
                            ? 'Usuario reactivado'
                            : `${reactivateTargets.length} cuentas reactivadas`,
                        )
                        setSelectedIds(new Set())
                      })
                    }
                    trigger={
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        disabled={reactivateTargets.length === 0 || actionMut.isPending}
                      >
                        <RotateCcw className="size-3.5" aria-hidden />
                        Reactivar ({reactivateTargets.length})
                      </Button>
                    }
                  />
                  <AdminConfirmDialog
                    title={
                      deactivateTargets.length === 1
                        ? '¿Desactivar esta cuenta?'
                        : `¿Desactivar ${deactivateTargets.length} cuentas?`
                    }
                    description="Los usuarios no podrán acceder hasta que un administrador los reactive. Los datos se conservan."
                    confirmLabel="Desactivar"
                    disabled={deactivateTargets.length === 0 || actionMut.isPending}
                    onConfirm={() =>
                      actionMut.mutate(async () => {
                        for (const u of deactivateTargets) {
                          await deactivateUser(u.id)
                        }
                        toast.success(
                          deactivateTargets.length === 1
                            ? 'Usuario desactivado'
                            : `${deactivateTargets.length} cuentas desactivadas`,
                        )
                        setSelectedIds(new Set())
                      })
                    }
                    trigger={
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        disabled={deactivateTargets.length === 0 || actionMut.isPending}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Desactivar ({deactivateTargets.length})
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </div>

            {soleSelectedUser ? (
              <>
                <EditUserModal
                  key={soleSelectedUser.id}
                  user={soleSelectedUser}
                  trigger={false}
                  open={editModalOpen}
                  onOpenChange={setEditModalOpen}
                  groups={groups}
                  categories={categories}
                  onSubmit={(values) => updateUserMut.mutate({ user: soleSelectedUser, ...values })}
                />
                <ChangePasswordModal
                  key={soleSelectedUser.id}
                  userId={soleSelectedUser.id}
                  trigger={false}
                  open={passwordModalOpen}
                  onOpenChange={setPasswordModalOpen}
                  onSubmit={(values) =>
                    actionMut.mutate(async () => {
                      await changeUserPassword(values)
                      toast.success('Contraseña actualizada')
                      setPasswordModalOpen(false)
                    })
                  }
                />
              </>
            ) : null}

            <div className="hidden md:block">
              <AdminDataTable
                rows={visibleUsers}
                columns={columns}
                getRowKey={(user) => user.id}
                footer={loadMoreFooter}
                rowSelection={{
                  selectedKeys: selectedIds,
                  onToggleRow: toggleSelectionRow,
                  onToggleAllVisible: toggleSelectionAllVisible,
                }}
              />
            </div>
            <div className="grid gap-4 md:hidden">
              {visibleUsers.map((user) => (
                <Card key={user.id} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className={cn(ADMIN_TABLE_ROW_CHECKBOX_CLASS, 'mt-1')}
                        checked={selectedIds.has(user.id)}
                        onChange={(event) => toggleSelectionRow(user.id, event.target.checked)}
                        aria-label={`Seleccionar ${user.full_name ?? user.phone ?? 'usuario'}`}
                      />
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="font-semibold text-[#102A43]">{user.full_name ?? user.phone ?? '—'}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                            <span className="tabular-nums">{user.phone ?? '—'}</span>
                            <span className="hidden sm:inline">·</span>
                            <span>{formatRecoveryEmailDisplay(user.email)}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {recoveryEmailComplete(user) ? (
                              <Badge
                                variant="secondary"
                                className="border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
                              >
                                Recuperación: listo
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="border-amber-200/90 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                              >
                                Recuperación: falta correo
                              </Badge>
                            )}
                            <AdminStatusBadge status={user.status === 'inactive' ? 'inactive' : 'active'} />
                          </div>
                        </div>
                        <div className="shrink-0">
                          <AdminStatusBadge status={user.role} />
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-[#64748B]">Grupo: {user.group?.name ?? 'Sin grupo'}</p>
                  </CardContent>
                </Card>
              ))}
              {hayMas ? (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg border border-border/30 px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted/50',
                    )}
                  >
                    <ChevronDown size={14} aria-hidden />
                    Ver {Math.min(PAGE_SIZE, totalOcultos)} más
                    <span className="text-xs text-muted-foreground/60">({totalOcultos} restantes)</span>
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
