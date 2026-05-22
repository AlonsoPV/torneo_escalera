import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  KeyRound,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
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
import { groupFilterOptionsFromRecords } from '@/components/admin/shared/adminMatchFilters'
import { ChangePasswordModal } from '@/components/admin/users/ChangePasswordModal'
import { CreateUserModal } from '@/components/admin/users/CreateUserModal'
import { EditUserModal } from '@/components/admin/users/EditUserModal'
import { AvailablePlayersPoolSection } from '@/components/admin/users/AvailablePlayersPoolSection'
import { UserBulkImportSection } from '@/components/admin/users/UserBulkImportSection'
import { Button, buttonVariants } from '@/components/ui/button'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TableCell, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  adminUserExportRow,
  downloadAdminUserExportRowsXlsx,
  downloadUsersImportTemplate,
  downloadUsersImportTemplateCsv,
  exportFilteredUsersCsv,
  exportFilteredUsersXlsx,
  exportUsersCredentialsCsv,
  exportUsersCredentialsXlsx,
} from '@/services/adminUsersExport'

const PAGE_SIZE = 25

function userMatchesGroupFilter(user: AdminUserRecord, groupFilter: string): boolean {
  if (groupFilter === 'all') return true
  const gid = user.group?.id
  if (!gid) return false
  return groupFilter.split('|').filter(Boolean).includes(gid)
}

function scrollToBulkImportSection(): void {
  const anchor = document.getElementById('admin-user-bulk-import-anchor')
  anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  if (anchor instanceof HTMLDetailsElement) {
    anchor.open = true
  }
}

export function AdminUsersPage() {
  const qc = useQueryClient()
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')
  const [estadoFilter, setEstadoFilter] = useState<'all' | 'pendiente' | 'cuenta_activa' | 'cuenta_inactiva'>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)

  const usersQ = useQuery({ queryKey: ['admin-users'], queryFn: getAdminUsers })
  const groupsQ = useQuery({ queryKey: ['admin-groups'], queryFn: () => getAdminGroups() })
  const categoriesQ = useQuery({ queryKey: ['player-categories'], queryFn: listPlayerCategories })
  const groups = useMemo(() => groupsQ.data ?? [], [groupsQ.data])
  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data])
  const groupOpts = useMemo(() => groupFilterOptionsFromRecords(groups), [groups])

  const refreshUsers = async () => {
    await qc.invalidateQueries({ queryKey: ['admin-users'] })
    await qc.invalidateQueries({ queryKey: ['admin-groups'] })
  }

  // Reinicia paginación al cambiar filtros.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset explícito de página al cambiar criterios
    setVisibleCount(PAGE_SIZE)
  }, [deferredSearch, roleFilter, groupFilter, categoryFilter, estadoFilter])

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
    const normalizedSearch = deferredSearch.trim().toLowerCase()
    return (usersQ.data ?? []).filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.full_name?.toLowerCase().includes(normalizedSearch) ||
        user.phone?.toLowerCase().includes(normalizedSearch) ||
        formatRecoveryEmailDisplay(user.email).toLowerCase().includes(normalizedSearch)
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesGroup = userMatchesGroupFilter(user, groupFilter)
      const matchesCategory = categoryFilter === 'all' || user.category_id === categoryFilter
      const matchesEstado =
        estadoFilter === 'all' ||
        (estadoFilter === 'pendiente' && !recoveryEmailComplete(user)) ||
        (estadoFilter === 'cuenta_activa' && user.status === 'active') ||
        (estadoFilter === 'cuenta_inactiva' && user.status === 'inactive')
      return matchesSearch && matchesRole && matchesGroup && matchesCategory && matchesEstado
    })
  }, [categoryFilter, deferredSearch, estadoFilter, groupFilter, roleFilter, usersQ.data])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recorta selección a filas aún visibles con filtros
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

  const requireFilteredUsersToast = (): boolean => {
    if (!filteredUsers.length) {
      toast.message('No hay usuarios que coincidan con los filtros actuales.')
      return false
    }
    return true
  }

  const exportSelectionRows = (): void => {
    if (!selectedUsers.length) {
      toast.message('Selecciona al menos un usuario para exportar.')
      return
    }
    downloadAdminUserExportRowsXlsx(
      selectedUsers.map((u) => adminUserExportRow(u, categories)),
      `usuarios_seleccion_mega_varonil_${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
    toast.success('Excel generado con la selección')
  }

  const toggleSelectionRow = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const toggleSelectionAllVisible = useCallback((select: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const keys = filteredUsers.slice(0, visibleCount).map((u) => u.id)
      if (select) keys.forEach((id) => next.add(id))
      else keys.forEach((id) => next.delete(id))
      return next
    })
  }, [filteredUsers, visibleCount])

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filteredUsers.map((u) => u.id)))
  }, [filteredUsers])

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
      queueMicrotask(() => {
        setEditModalOpen(false)
        setPasswordModalOpen(false)
      })
    }
  }, [selectedUsers.length])

  const columns = useMemo<AdminDataTableColumn<AdminUserRecord>[]>(
    () => [
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
    ],
    [],
  )

  const groupTriggerLabel =
    groupFilter === 'all' ? 'Todos los grupos' : (groupOpts.find((o) => o.value === groupFilter)?.label ?? 'Grupo')

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
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Administración"
        title="Usuarios"
        description="Administra jugadores, roles y credenciales. Exporta listados compatibles con la carga masiva (mismas columnas)."
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-muted/25 px-3 py-2.5">
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exportaciones</span>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={scrollToBulkImportSection}>
          Importar usuarios
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => downloadUsersImportTemplate()}>
          <Download className="size-3.5" aria-hidden />
          Plantilla · Excel
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => downloadUsersImportTemplateCsv()}>
          <Download className="size-3.5" aria-hidden />
          Plantilla · CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs border-emerald-200 bg-emerald-50/70 text-emerald-950 hover:bg-emerald-100/80 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50"
          disabled={!filteredUsers.length}
          onClick={() => {
            if (!requireFilteredUsersToast()) return
            exportUsersCredentialsXlsx(filteredUsers, categories)
            toast.success('Credenciales (Excel)')
          }}
        >
          <FileSpreadsheet className="size-3.5" aria-hidden />
          Credenciales · Excel
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs border-emerald-200 bg-emerald-50/70 text-emerald-950 hover:bg-emerald-100/80 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50"
          disabled={!filteredUsers.length}
          onClick={() => {
            if (!requireFilteredUsersToast()) return
            exportUsersCredentialsCsv(filteredUsers, categories)
            toast.success('Credenciales (CSV)')
          }}
        >
          <FileSpreadsheet className="size-3.5" aria-hidden />
          Credenciales · CSV
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className={cn(
              buttonVariants({ variant: 'secondary', size: 'sm' }),
              'h-9 gap-1.5 text-xs shrink-0',
            )}
          >
            <MoreHorizontal className="size-3.5" aria-hidden />
            Exportar
            <ChevronDown className="size-3.5 opacity-70" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Credenciales (filtros actuales)</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={!filteredUsers.length}
              onClick={() => {
                if (!requireFilteredUsersToast()) return
                exportUsersCredentialsXlsx(filteredUsers, categories)
                toast.success('Credenciales (Excel)')
              }}
            >
              Credenciales · Excel
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!filteredUsers.length}
              onClick={() => {
                if (!requireFilteredUsersToast()) return
                exportUsersCredentialsCsv(filteredUsers, categories)
                toast.success('Credenciales (CSV)')
              }}
            >
              Credenciales · CSV
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Usuarios filtrados</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={!filteredUsers.length}
              onClick={() => {
                if (!requireFilteredUsersToast()) return
                exportFilteredUsersXlsx(filteredUsers, categories)
                toast.success('Usuarios filtrados (Excel)')
              }}
            >
              Excel
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!filteredUsers.length}
              onClick={() => {
                if (!requireFilteredUsersToast()) return
                exportFilteredUsersCsv(filteredUsers, categories)
                toast.success('Usuarios filtrados (CSV)')
              }}
            >
              CSV
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Plantilla carga masiva</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => downloadUsersImportTemplate()}>Excel</DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadUsersImportTemplateCsv()}>CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <section className="space-y-3 sm:space-y-4" aria-labelledby="user-intake-heading">
        <AdminSectionTitle
          id="user-intake-heading"
          title="Dar de alta usuarios"
          description="Para una persona usa el alta rápido. Para inscribir a varios de una vez, despliega la carga masiva desde Excel."
        />
        <Card className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-emerald-900/[0.05]">
          <CardContent className="p-0">
            <div className="flex flex-col gap-4 bg-gradient-to-br from-emerald-50/60 via-white to-white p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
              <div className="flex min-w-0 flex-1 gap-4">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-sm ring-1 ring-emerald-900/10 sm:size-[3.25rem]"
                  aria-hidden
                >
                  <UserPlus className="size-[1.35rem] sm:size-6" />
                </span>
                <div className="min-w-0 space-y-1">
                  <h3 className="text-base font-semibold tracking-tight text-slate-900">Usuario único</h3>
                  <p className="max-w-xl text-sm leading-relaxed text-slate-600">
                    Nombre completo, celular como cuenta de acceso, contraseña temporal y opcionalmente grupo. La categoría debe existir antes de crear al jugador.
                  </p>
                </div>
              </div>
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
            </div>
            <UserBulkImportSection />
          </CardContent>
        </Card>
      </section>

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
              className={cn('h-11 pl-9', search !== deferredSearch && 'opacity-70')}
              placeholder="Buscar por nombre, celular o correo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar usuarios"
              aria-busy={search !== deferredSearch}
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
          <Select value={estadoFilter} onValueChange={(value) => setEstadoFilter(value as typeof estadoFilter)}>
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
              <SelectItem value="cuenta_activa" label="Cuenta activa (admin)">
                Cuenta activa (admin)
              </SelectItem>
              <SelectItem value="cuenta_inactiva" label="Cuenta desactivada (admin)">
                Cuenta desactivada (admin)
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupFilter} onValueChange={(value) => setGroupFilter(value ?? 'all')}>
            <SelectTrigger
              className="h-11 min-w-[160px] w-[min(100%,13rem)]"
              title={
                groupFilter !== 'all' && groupFilter.includes('|')
                  ? 'Varios grupos comparten este nombre; el filtro incluye a todos.'
                  : undefined
              }
            >
              <SelectValue placeholder="Grupo" className="truncate">
                {groupTriggerLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="Todos los grupos">
                Todos los grupos
              </SelectItem>
              {groupOpts.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} label={opt.label}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </AdminToolbar>
      </section>

      <section className="space-y-4" aria-labelledby="users-list-heading">
        <AdminSectionTitle
          id="users-list-heading"
          title="Listado"
          description={`${filteredUsers.length} resultado(s) con filtros actuales · ${stats.total} usuarios en total. Marca filas y usa la barra de acciones. «Recuperación» = correo para reset. «Cuenta» = alta o baja por administrador.`}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={filteredUsers.length === 0}
                  onClick={selectAllFiltered}
                >
                  Seleccionar todos ({filteredUsers.length})
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
                    onClick={exportSelectionRows}
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
