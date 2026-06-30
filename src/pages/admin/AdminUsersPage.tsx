import {
  ChevronDown,
  KeyRound,
  Pencil,
  RotateCcw,
  Smartphone,
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
  type AdminDataTableSort,
} from '@/components/admin/shared/AdminDataTable'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminMetricCard, ADMIN_METRIC_GRID_4 } from '@/components/admin/shared/AdminMetricCard'
import {
  AdminMatchScopeFiltersBar,
  type AdminScopeFilterSelectConfig,
} from '@/components/admin/shared/AdminMatchScopeFiltersBar'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { AdminStatusBadge } from '@/components/admin/shared/AdminStatusBadge'
import { groupFilterOptionsFromRecords } from '@/components/admin/shared/adminMatchFilters'
import { ChangePasswordModal } from '@/components/admin/users/ChangePasswordModal'
import { CreateUserModal } from '@/components/admin/users/CreateUserModal'
import { EditUserModal } from '@/components/admin/users/EditUserModal'
import { UserBulkImportSection } from '@/components/admin/users/UserBulkImportSection'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
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
import { invokeAdminUpdateUserContact } from '@/services/authEdge'
import { listPlayerCategories } from '@/services/playerCategories'
import { listTournaments } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { UserRole } from '@/types/database'

const PAGE_SIZE = 25

const ADMIN_USERS_QUERY_OPTIONS = {
  refetchOnMount: 'always' as const,
  staleTime: 30_000,
}

function AdminUsersDirectorySkeleton() {
  return (
    <div
      className="space-y-4 sm:space-y-5"
      aria-busy="true"
      aria-live="polite"
      aria-label="Cargando directorio de usuarios"
    >
      <div className={cn(ADMIN_METRIC_GRID_4, 'max-sm:gap-3')}>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[7.5rem] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}

type UserSortKey = 'id' | 'name' | 'phone' | 'group' | 'entry_position' | 'ranking_position'

function userSortValue(user: AdminUserRecord, key: UserSortKey): string {
  switch (key) {
    case 'id':
      return user.external_id ?? ''
    case 'name':
      return user.full_name ?? ''
    case 'phone':
      return user.phone ?? ''
    case 'group':
      return user.group?.name ?? ''
    case 'entry_position':
      return String(user.tournamentEntryPosition ?? 9999).padStart(4, '0')
    case 'ranking_position':
      return String(user.tournamentRankingPosition ?? 9999).padStart(4, '0')
    default:
      return ''
  }
}

function compareUsers(a: AdminUserRecord, b: AdminUserRecord, sort: { key: UserSortKey; direction: 'asc' | 'desc' }) {
  const av = userSortValue(a, sort.key)
  const bv = userSortValue(b, sort.key)
  const cmp = av.localeCompare(bv, 'es', { numeric: true, sensitivity: 'base' })
  return sort.direction === 'asc' ? cmp : -cmp
}

function userMatchesGroupFilter(user: AdminUserRecord, groupFilter: string): boolean {
  if (groupFilter === 'all') return true
  const gid = user.group?.id
  if (!gid) return false
  return groupFilter.split('|').filter(Boolean).includes(gid)
}

async function copyPhoneToClipboard(phone: string, displayName: string) {
  const normalizedPhone = phone.trim()
  if (!normalizedPhone) return

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard API unavailable')
    }
    await navigator.clipboard.writeText(normalizedPhone)
    toast.success('Celular copiado', {
      description: `${displayName}: ${normalizedPhone}`,
    })
  } catch {
    toast.error('No se pudo copiar el celular', {
      description: normalizedPhone,
    })
  }
}

function UserNameWithPhoneCopy({ user }: { user: AdminUserRecord }) {
  const displayName = user.full_name ?? user.phone ?? 'Sin nombre'
  const phone = user.phone?.trim() ?? ''
  const hasPhone = phone.length > 0

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle">
      <span className="min-w-0 truncate text-xs font-medium leading-tight text-[#102A43]" title={displayName}>
        {displayName}
      </span>
      <button
        type="button"
        className={cn(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/30',
          hasPhone
            ? 'border-emerald-200 bg-emerald-50 text-[#1F5A4C] shadow-sm hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-900'
            : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300',
        )}
        disabled={!hasPhone}
        title={hasPhone ? `Copiar celular: ${phone}` : 'Sin celular registrado'}
        aria-label={hasPhone ? `Copiar celular de ${displayName}` : `${displayName} no tiene celular registrado`}
        onClick={(event) => {
          event.stopPropagation()
          void copyPhoneToClipboard(phone, displayName)
        }}
      >
        <Smartphone className="size-3.5" aria-hidden />
      </button>
    </span>
  )
}

export function AdminUsersPage() {
  const qc = useQueryClient()
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [tournamentFilter, setTournamentFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')
  const [sort, setSort] = useState<AdminDataTableSort>({ key: 'name', direction: 'asc' })
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)

  const tournamentsQ = useQuery({
    queryKey: ['admin-tournaments'],
    queryFn: listTournaments,
    ...ADMIN_USERS_QUERY_OPTIONS,
  })
  const tournaments = useMemo(() => tournamentsQ.data ?? [], [tournamentsQ.data])
  const activeTournament = useMemo(
    () => tournaments.find((tournament) => tournament.status === 'active') ?? null,
    [tournaments],
  )
  const selectedTournamentId = tournamentFilter || activeTournament?.id || tournaments[0]?.id || 'all'
  const selectedTournamentName =
    selectedTournamentId === 'all'
      ? 'Todos los torneos'
      : tournaments.find((tournament) => tournament.id === selectedTournamentId)?.name ?? 'Torneo'
  const selectedTournamentForQuery = selectedTournamentId === 'all' ? undefined : selectedTournamentId

  const usersQ = useQuery({
    queryKey: ['admin-users', selectedTournamentId],
    queryFn: () => getAdminUsers(selectedTournamentForQuery),
    enabled: tournamentsQ.isSuccess,
    ...ADMIN_USERS_QUERY_OPTIONS,
  })
  const groupsQ = useQuery({
    queryKey: ['admin-groups', selectedTournamentId],
    queryFn: () => getAdminGroups(selectedTournamentForQuery),
    enabled: tournamentsQ.isSuccess,
    ...ADMIN_USERS_QUERY_OPTIONS,
  })
  const categoriesQ = useQuery({
    queryKey: ['player-categories'],
    queryFn: listPlayerCategories,
    ...ADMIN_USERS_QUERY_OPTIONS,
  })
  const groups = useMemo(() => groupsQ.data ?? [], [groupsQ.data])
  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data])

  const isDirectoryLoading = tournamentsQ.isPending || usersQ.isPending || groupsQ.isPending || categoriesQ.isPending
  const isDirectoryRefreshing =
    !isDirectoryLoading && (tournamentsQ.isFetching || usersQ.isFetching || groupsQ.isFetching || categoriesQ.isFetching)
  const groupOpts = useMemo(
    () => groupFilterOptionsFromRecords(groups, { primarySort: 'group_number' }),
    [groups],
  )

  /** Orden estable para el desplegable de categorías (solo UI de filtros). */
  const categoriesSortedForFilter = useMemo(
    () =>
      [...categories].sort((a, b) =>
        a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' }),
      ),
    [categories],
  )

  const refreshUsers = async () => {
    await qc.invalidateQueries({ queryKey: ['admin-users'] })
    await qc.invalidateQueries({ queryKey: ['admin-groups'] })
  }

  // Reinicia paginación al cambiar filtros.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset explícito de página al cambiar criterios
    setVisibleCount(PAGE_SIZE)
  }, [deferredSearch, roleFilter, tournamentFilter, selectedTournamentId, groupFilter, categoryFilter, sort.key, sort.direction])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- al cambiar torneo, los grupos disponibles cambian
    setGroupFilter('all')
  }, [selectedTournamentId])

  const handleSortChange = useCallback((next: AdminDataTableSort) => {
    setSort(next)
  }, [])

  const updateUserMut = useMutation({
    mutationFn: async (input: {
      user: AdminUserRecord
      phone: string
      recoveryEmail: string | null
      fullName: string
      role: UserRole
      categoryId: string
      groupId?: string
    }) => {
      if (!input.phone.trim()) {
        throw new Error('El celular es obligatorio.')
      }
      await invokeAdminUpdateUserContact({
        userId: input.user.id,
        phone: input.phone,
        recoveryEmail: input.recoveryEmail,
      })
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
    const scoped = selectedTournamentId === 'all' ? all : all.filter((u) => Boolean(u.group))
    return {
      total: scoped.length,
      jugadores: scoped.filter((u) => u.role === 'player').length,
      sinCategoria: scoped.filter((u) => !u.category_id).length,
      sinGrupo: scoped.filter((u) => !u.group).length,
    }
  }, [selectedTournamentId, usersQ.data])

  const userMetricContext = useMemo(() => {
    const { total, jugadores } = stats
    return {
      playersPct: total > 0 ? Math.round((jugadores / total) * 100) : 0,
      otrosRoles: total - jugadores,
    }
  }, [stats])

  const filteredUsers = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()
    return (usersQ.data ?? []).filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.full_name?.toLowerCase().includes(normalizedSearch) ||
        user.phone?.toLowerCase().includes(normalizedSearch) ||
        user.external_id?.toLowerCase().includes(normalizedSearch)
      const matchesTournament = selectedTournamentId === 'all' || Boolean(user.group)
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesGroup = userMatchesGroupFilter(user, groupFilter)
      const matchesCategory = categoryFilter === 'all' || user.category_id === categoryFilter
      return matchesSearch && matchesTournament && matchesRole && matchesGroup && matchesCategory
    })
  }, [categoryFilter, deferredSearch, groupFilter, roleFilter, selectedTournamentId, usersQ.data])

  const sortedFilteredUsers = useMemo(() => {
    const list = [...filteredUsers]
    list.sort((a, b) => compareUsers(a, b, sort as { key: UserSortKey; direction: 'asc' | 'desc' }))
    return list
  }, [filteredUsers, sort])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recorta selección a filas aún visibles con filtros
    setSelectedIds((prev) => {
      const allowed = new Set(sortedFilteredUsers.map((u) => u.id))
      const next = new Set<string>()
      for (const id of prev) {
        if (allowed.has(id)) next.add(id)
      }
      return next
    })
  }, [sortedFilteredUsers])

  const visibleUsers = useMemo(() => sortedFilteredUsers.slice(0, visibleCount), [sortedFilteredUsers, visibleCount])
  const hayMas = visibleCount < sortedFilteredUsers.length
  const totalOcultos = sortedFilteredUsers.length - visibleCount

  const selectedUsers = useMemo(
    () => sortedFilteredUsers.filter((u) => selectedIds.has(u.id)),
    [sortedFilteredUsers, selectedIds],
  )

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
      const keys = sortedFilteredUsers.slice(0, visibleCount).map((u) => u.id)
      if (select) keys.forEach((id) => next.add(id))
      else keys.forEach((id) => next.delete(id))
      return next
    })
  }, [sortedFilteredUsers, visibleCount])

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(sortedFilteredUsers.map((u) => u.id)))
  }, [sortedFilteredUsers])

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
        key: 'id',
        header: 'ID',
        sortable: true,
        className: 'w-[5.5rem]',
        render: (user) => (
          <span
            id={`admin-user-cell-id-${user.id}`}
            data-name="user-id-cell"
            className="font-mono text-xs tabular-nums leading-tight text-[#64748B]"
            title={user.external_id ?? undefined}
          >
            {user.external_id ?? '—'}
          </span>
        ),
      },
      {
        key: 'name',
        header: 'Nombre',
        sortable: true,
        render: (user) => <UserNameWithPhoneCopy user={user} />,
      },
      {
        key: 'phone',
        header: 'Celular',
        sortable: true,
        render: (user) => (
          <span className="tabular-nums text-xs leading-tight text-[#334E68]">{user.phone ?? '—'}</span>
        ),
      },
      {
        key: 'group',
        header: 'Grupo',
        sortable: true,
        render: (user) => (
          <span className="max-w-[10rem] truncate text-xs leading-tight" title={user.group?.name ?? 'Sin grupo'}>
            {user.group?.name ?? 'Sin grupo'}
          </span>
        ),
      },
      {
        key: 'entry_position',
        header: 'Entró',
        sortable: true,
        headerTitle: 'Posición en la que entró al grupo del torneo seleccionado.',
        render: (user) => (
          <span className="font-mono text-xs font-semibold tabular-nums text-[#334E68]">
            {user.tournamentEntryPosition ? `#${user.tournamentEntryPosition}` : '—'}
          </span>
        ),
      },
      {
        key: 'ranking_position',
        header: 'Ranking',
        sortable: true,
        headerTitle: 'Posición actual del jugador en el ranking de su grupo para el torneo seleccionado.',
        render: (user) => (
          <span className="font-mono text-xs font-semibold tabular-nums text-[#0F766E]">
            {user.tournamentRankingPosition ? `#${user.tournamentRankingPosition}` : '—'}
          </span>
        ),
      },
    ],
    [],
  )

  const groupTriggerLabel =
    groupFilter === 'all' ? 'Todos' : (groupOpts.find((o) => o.value === groupFilter)?.label ?? 'Grupo')

  const roleTriggerLabel = roleFilter === 'all' ? 'Todos' : userRoleLabelEs(roleFilter)

  const categoryTriggerLabel =
    categoryFilter === 'all'
      ? 'Todas'
      : categoriesSortedForFilter.find((c) => c.id === categoryFilter)?.name ?? categories.find((c) => c.id === categoryFilter)?.name ?? 'Categoría'

  const hasActiveFilters =
    deferredSearch.trim() !== '' ||
    tournamentFilter !== '' ||
    roleFilter !== 'all' ||
    groupFilter !== 'all' ||
    categoryFilter !== 'all'

  const clearUserFilters = useCallback(() => {
    setSearch('')
    setTournamentFilter('')
    setRoleFilter('all')
    setGroupFilter('all')
    setCategoryFilter('all')
  }, [])

  const userFilterSelects = useMemo((): AdminScopeFilterSelectConfig[] => {
    return [
      {
        id: 'tournament',
        label: 'Torneo',
        value: selectedTournamentId,
        valueLabel: selectedTournamentName,
        onValueChange: (value) => setTournamentFilter(value ?? ''),
        items: [
          ...tournaments.map((tournament) => ({
            value: tournament.id,
            label: tournament.status === 'active' ? `${tournament.name} (activo)` : tournament.name,
          })),
          { value: 'all', label: 'Todos los torneos' },
        ],
      },
      {
        id: 'role',
        label: 'Rol',
        value: roleFilter,
        valueLabel: roleTriggerLabel,
        onValueChange: (value) => setRoleFilter((value ?? 'all') as UserRole | 'all'),
        items: [
          { value: 'all', label: 'Todos' },
          ...ADMIN_USER_FILTER_ROLES.map((r) => ({ value: r, label: userRoleLabelEs(r) })),
        ],
      },
      {
        id: 'category',
        label: 'Categoría',
        value: categoryFilter,
        valueLabel: categoryTriggerLabel,
        onValueChange: (value) => setCategoryFilter(value ?? 'all'),
        items: [
          { value: 'all', label: 'Todas' },
          ...categoriesSortedForFilter.map((c) => ({ value: c.id, label: c.name })),
        ],
      },
      {
        id: 'group',
        label: 'Grupo',
        value: groupFilter,
        valueLabel: groupTriggerLabel,
        triggerTitle:
          groupFilter !== 'all' && groupFilter.includes('|')
            ? 'Varios grupos comparten este nombre; el filtro incluye a todos.'
            : undefined,
        onValueChange: (value) => setGroupFilter(value ?? 'all'),
        items: [{ value: 'all', label: 'Todos' }, ...groupOpts.map((opt) => ({ value: opt.value, label: opt.label }))],
      },
    ]
  }, [
    categoriesSortedForFilter,
    categoryFilter,
    categoryTriggerLabel,
    groupFilter,
    groupOpts,
    groupTriggerLabel,
    roleFilter,
    roleTriggerLabel,
    selectedTournamentId,
    selectedTournamentName,
    tournaments,
  ])

  const loadMoreFooter =
    hayMas && sortedFilteredUsers.length > 0 ? (
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
        description="Administra jugadores, roles y credenciales. Verás métricas en tarjetas (totales y pendientes por categoría/grupo), filtros y listado. La carga masiva está en «Dar de alta usuarios»."
        actions={
          isDirectoryRefreshing ? (
            <span className="text-xs font-medium text-muted-foreground">Actualizando directorio…</span>
          ) : undefined
        }
      />

      {/* Barra «Exportaciones» (plantillas Excel/CSV, credenciales y menú Exportar) deshabilitada; ver historial git para recuperar el marcado JSX. */}

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
                disabled={isDirectoryLoading}
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

      {usersQ.isError && usersQ.data === undefined ? (
        <AdminEmptyState
          id="admin-users-load-error"
          title="No se pudo cargar el directorio de usuarios"
          description={
            usersQ.error instanceof Error
              ? usersQ.error.message
              : 'Revisa permisos de administrador o la conexión con Supabase.'
          }
          icon={Users}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void usersQ.refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : isDirectoryLoading ? (
        <AdminUsersDirectorySkeleton />
      ) : (
        <>
      <section className="space-y-4 sm:space-y-5" aria-labelledby="users-metrics-heading">
        <AdminSectionTitle
          id="users-metrics-heading"
          title="Métricas del directorio"
          density="compact"
          description="Totales globales del sistema; no cambian con los filtros del listado inferior. Úsalas para detectar pendientes de categoría o grupo antes de dar de alta más jugadores o abrir torneos."
        />
        <div className={cn(ADMIN_METRIC_GRID_4, 'max-sm:gap-3')}>
          <AdminMetricCard
            id="admin-users-metric-total"
            label="Total usuarios"
            value={stats.total}
            tone="neutral"
            compact
            descriptionMode="info"
            description="Total de perfiles dentro del alcance actual. Incluye administradores, jugadores y demás roles configurados."
            trend={stats.total === 0 ? undefined : `${userMetricContext.playersPct}% son rol jugador`}
          />
          <AdminMetricCard
            id="admin-users-metric-players"
            label="Jugadores"
            value={stats.jugadores}
            tone="info"
            compact
            descriptionMode="info"
            description="Usuarios con rol jugador dentro del alcance actual del listado."
            trend={
              stats.total === 0
                ? undefined
                : userMetricContext.otrosRoles > 0
                  ? `${userMetricContext.otrosRoles} cuenta${userMetricContext.otrosRoles === 1 ? '' : 's'} con otro rol`
                  : '100% del directorio tiene rol jugador'
            }
          />
          <AdminMetricCard
            id="admin-users-metric-no-category"
            label="Sin categoría"
            value={stats.sinCategoria}
            tone={stats.sinCategoria > 0 ? 'warning' : 'success'}
            compact
            descriptionMode="info"
            description="Jugadores u otros usuarios sin categoría deportiva asignada en su perfil. Asígnalas desde editar usuario o cargas masivas."
            trend={stats.sinCategoria === 0 ? 'Todas las cuentas tienen categoría' : 'Revísalos en filtros o edición'}
          />
          <AdminMetricCard
            id="admin-users-metric-no-group"
            label="Sin grupo"
            value={stats.sinGrupo}
            tone={stats.sinGrupo > 0 ? 'warning' : 'success'}
            compact
            descriptionMode="info"
            description="Perfiles que aún no pertenecen a ningún grupo de torneo. Inscribirlos desde Grupos o al crear el usuario ayuda al armado del draw."
            trend={stats.sinGrupo === 0 ? 'Nadie quedó huérfano de grupo' : 'Útiles para completar roster'}
          />
        </div>
      </section>

      <AdminMatchScopeFiltersBar
        heading="Filtros"
        description="Busca por nombre, ID o celular. Refina por torneo, rol, categoría y grupo."
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Buscar por nombre, ID o celular…',
          ariaLabel: 'Buscar usuarios',
        }}
        selects={userFilterSelects}
        onClear={clearUserFilters}
        clearLabel={hasActiveFilters ? 'Limpiar filtros' : 'Restablecer'}
      />

      <section className="space-y-3 sm:space-y-4" aria-label="Listado de usuarios">
        <div
          id="admin-users-list-summary"
          data-name="users-list-summary"
          className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/40 p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex items-baseline gap-1.5 rounded-lg bg-[#102A43] px-3 py-1.5 text-white shadow-sm">
                <span className="text-lg font-semibold tabular-nums leading-none">{sortedFilteredUsers.length}</span>
                <span className="text-xs font-medium text-white/85">
                  {sortedFilteredUsers.length === 1 ? 'resultado' : 'resultados'}
                </span>
              </span>
              <span className="text-sm text-slate-600">
                de <span className="font-medium tabular-nums text-slate-800">{stats.total}</span> en el directorio
              </span>
              {hasActiveFilters ? (
                <Badge
                  variant="secondary"
                  className="h-6 border-amber-200/90 bg-amber-50 px-2 text-[11px] font-medium text-amber-950"
                >
                  Filtros activos
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="h-6 border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-600"
                >
                  Sin filtros
                </Badge>
              )}
              {visibleUsers.length < sortedFilteredUsers.length ? (
                <span className="text-xs text-slate-500">
                  Mostrando {visibleUsers.length} · usa «Ver más» al final
                </span>
              ) : null}
            </div>
            <dl className="grid min-w-0 gap-2 sm:grid-cols-2 lg:max-w-lg lg:gap-x-4 lg:gap-y-1.5">
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Torneo</dt>
                <dd className="truncate text-xs leading-snug text-slate-600" title={selectedTournamentName}>
                  {selectedTournamentName}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Posiciones</dt>
                <dd className="text-xs leading-snug text-slate-600">Entrada al grupo y ranking actual.</dd>
              </div>
            </dl>
          </div>
        </div>

        {usersQ.isError ? (
          <AdminEmptyState
            title="No se pudo cargar el directorio de usuarios."
            description={usersQ.error instanceof Error ? usersQ.error.message : 'Revisa permisos o conexión con Supabase.'}
            icon={Users}
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => void usersQ.refetch()}>
                Reintentar
              </Button>
            }
          />
        ) : sortedFilteredUsers.length === 0 ? (
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
              className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white px-3 py-3 shadow-sm ring-1 ring-slate-900/[0.04] sm:flex-row sm:flex-wrap sm:items-center sm:px-4 sm:py-3.5"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
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
                  disabled={sortedFilteredUsers.length === 0}
                  onClick={selectAllFiltered}
                >
                  Seleccionar todos ({sortedFilteredUsers.length})
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
                tableId="admin-users-table"
                rows={visibleUsers}
                columns={columns}
                getRowKey={(user) => user.id}
                getRowDomId={(user) => `admin-user-row-${user.id}`}
                footer={loadMoreFooter}
                sort={sort}
                onSortChange={handleSortChange}
                rowSelection={{
                  selectedKeys: selectedIds,
                  onToggleRow: toggleSelectionRow,
                  onToggleAllVisible: toggleSelectionAllVisible,
                }}
              />
            </div>
            <div className="flex flex-col gap-3 md:hidden">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium text-slate-600">Ordenar listado</p>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={sort.key}
                    onValueChange={(value) => {
                      if (!value) return
                      setSort((prev) => ({ key: value, direction: prev.direction }))
                    }}
                  >
                    <SelectTrigger id="admin-users-mobile-sort-key" className="h-9 min-w-[9rem] flex-1 sm:flex-none">
                      <SelectValue placeholder="Columna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id" label="ID">
                        ID
                      </SelectItem>
                      <SelectItem value="name" label="Nombre">
                        Nombre
                      </SelectItem>
                      <SelectItem value="phone" label="Celular">
                        Celular
                      </SelectItem>
                      <SelectItem value="group" label="Grupo">
                        Grupo
                      </SelectItem>
                      <SelectItem value="entry_position" label="Entró">
                        Entró
                      </SelectItem>
                      <SelectItem value="ranking_position" label="Ranking">
                        Ranking
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    id="admin-users-mobile-sort-direction"
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() => setSort((prev) => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
                  >
                    {sort.direction === 'asc' ? 'Ascendente' : 'Descendente'}
                  </Button>
                </div>
              </div>
              <div className="grid gap-4">
              {visibleUsers.map((user) => (
                <Card key={user.id} id={`admin-user-row-${user.id}`} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
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
                          <div className="flex max-w-full items-center">
                            <UserNameWithPhoneCopy user={user} />
                          </div>
                          <p className="font-mono text-xs tabular-nums text-[#64748B]">
                            ID: {user.external_id ?? '—'}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                            <span className="tabular-nums">{user.phone ?? '—'}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="border-slate-200 bg-slate-50 text-slate-700">
                              Entró: {user.tournamentEntryPosition ? `#${user.tournamentEntryPosition}` : '—'}
                            </Badge>
                            <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-emerald-900">
                              Ranking: {user.tournamentRankingPosition ? `#${user.tournamentRankingPosition}` : '—'}
                            </Badge>
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
            </div>
          </>
        )}
      </section>
        </>
      )}
    </div>
  )
}
