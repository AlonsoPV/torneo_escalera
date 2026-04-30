import { Flag, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { GroupAdminCard } from '@/components/admin/groups/GroupAdminCard'
import { GroupPlayerManager } from '@/components/admin/groups/GroupPlayerManager'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { assignPlayerToGroup, getAdminGroups, removePlayerFromGroup, updateGroup, type AdminGroupRecord } from '@/services/admin'
import {
  createGroupCategory,
  deleteGroupCategory,
  ensureDefaultGroupCategories,
  listGroupCategories,
  updateGroupCategory,
} from '@/services/groupCategories'
import { createGroup } from '@/services/groups'
import { generateRoundRobinMatches, type GenerateRrMode } from '@/services/matches'
import { listProfilesForAdmin } from '@/services/profiles'
import { listTournaments } from '@/services/tournaments'
import type { GroupCategory } from '@/types/database'
import { useAuthStore } from '@/stores/authStore'

function GroupCategoriesPanel({
  categories,
  disabled,
  onAdd,
  onRename,
  onReorder,
  onDelete,
}: {
  categories: GroupCategory[]
  disabled: boolean
  onAdd: (name: string) => void
  onRename: (id: string, name: string) => void
  onReorder: (id: string, order_index: number) => void
  onDelete: (id: string) => void
}) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <form
        className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-end sm:p-5"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = newName.trim()
          if (!trimmed) return
          onAdd(trimmed)
          setNewName('')
        }}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="new-category-name" className="text-xs font-medium text-slate-600">
            Nueva categoría
          </Label>
          <Input
            id="new-category-name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Ej. Sub-17"
            disabled={disabled}
          />
        </div>
        <Button type="submit" className="w-full shrink-0 sm:w-auto" disabled={disabled || !newName.trim()}>
          <Plus className="size-4" />
          Añadir
        </Button>
      </form>
      {categories.length === 0 ? (
        <p className="p-5 text-sm text-slate-500 sm:p-6">No hay categorías. Añade la primera arriba.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0 flex-1">
                  {editingId === category.id ? (
                    <Input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      disabled={disabled}
                      className="h-9"
                    />
                  ) : (
                    <p className="truncate font-medium text-[#102A43]">{category.name}</p>
                  )}
                </div>
                {editingId === category.id ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={disabled || !editName.trim()}
                      onClick={() => {
                        onRename(category.id, editName.trim())
                        setEditingId(null)
                      }}
                    >
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="shrink-0"
                    disabled={disabled}
                    onClick={() => {
                      setEditingId(category.id)
                      setEditName(category.name)
                    }}
                  >
                    <Pencil className="size-4" />
                    <span className="sr-only">Editar nombre</span>
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3 sm:shrink-0">
                <div className="flex items-center gap-2">
                  <Label className="whitespace-nowrap text-xs text-slate-500">Orden</Label>
                  <Input
                    type="number"
                    className="h-9 w-16"
                    defaultValue={category.order_index}
                    disabled={disabled || editingId === category.id}
                    key={`${category.id}-${category.order_index}`}
                    onBlur={(event) => {
                      const next = Number(event.target.value)
                      if (Number.isFinite(next) && next !== category.order_index) {
                        onReorder(category.id, next)
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={disabled || editingId === category.id}
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.confirm('¿Eliminar esta categoría? Los grupos quedarán sin categoría.')) {
                      onDelete(category.id)
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Eliminar categoría</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CreateGroupModal({
  tournamentId,
  categories,
  onCreate,
}: {
  tournamentId: string
  categories: GroupCategory[]
  onCreate: (name: string, groupCategoryId: string | null) => void
}) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<string>('none')

  return (
    <AdminFormModal
      trigger={
        <Button className="w-full sm:w-auto" disabled={!tournamentId || tournamentId === 'all'}>
          <Plus className="size-4" />
          Crear grupo
        </Button>
      }
      title="Crear grupo"
      description="Los grupos admiten hasta 5 jugadores. Opcionalmente asigna una categoría."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onCreate(
            name,
            categoryId && categoryId !== 'none' ? categoryId : null,
          )
          setName('')
          setCategoryId('none')
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="group-create-name">Nombre del grupo</Label>
          <Input id="group-create-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Categoría (opcional)</Label>
          <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? 'none')}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue placeholder="Sin categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin categoría</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full">
          Crear grupo
        </Button>
      </form>
    </AdminFormModal>
  )
}

export function AdminGroupsPage() {
  const qc = useQueryClient()
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)
  const [tournamentId, setTournamentId] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [managedGroup, setManagedGroup] = useState<AdminGroupRecord | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)

  const groupsQ = useQuery({ queryKey: ['admin-groups'], queryFn: () => getAdminGroups() })
  const profilesQ = useQuery({ queryKey: ['profiles-admin'], queryFn: listProfilesForAdmin })
  const tournamentsQ = useQuery({ queryKey: ['admin-tournaments'], queryFn: listTournaments })

  const categoriesQ = useQuery({
    queryKey: ['group-categories', tournamentId],
    queryFn: async () => {
      if (tournamentId === 'all') return []
      await ensureDefaultGroupCategories(tournamentId)
      return listGroupCategories(tournamentId)
    },
    enabled: tournamentId !== 'all',
  })

  const categories = categoriesQ.data ?? []

  const managerCategoriesQ = useQuery({
    queryKey: ['group-categories', managedGroup?.tournament_id],
    queryFn: async () => {
      const tid = managedGroup!.tournament_id
      await ensureDefaultGroupCategories(tid)
      return listGroupCategories(tid)
    },
    enabled: !!managedGroup?.tournament_id && managerOpen && tournamentId === 'all',
  })

  const categoriesForManager =
    tournamentId !== 'all' ? categories : (managerCategoriesQ.data ?? [])

  useEffect(() => {
    if (!managedGroup) return
    const freshGroup = groupsQ.data?.find((group) => group.id === managedGroup.id)
    if (freshGroup) setManagedGroup(freshGroup)
  }, [groupsQ.data, managedGroup])

  const refreshGroups = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['admin-groups'] }),
      qc.invalidateQueries({ queryKey: ['admin-overview'] }),
    ])
  }

  const refreshCategories = async () => {
    await qc.invalidateQueries({ queryKey: ['group-categories', tournamentId] })
  }

  const actionMut = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: async () => {
      toast.success('Grupo actualizado')
      await refreshGroups()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al actualizar grupo'),
  })

  const createMut = useMutation({
    mutationFn: async (input: { name: string; groupCategoryId: string | null }) => {
      if (tournamentId === 'all') throw new Error('Selecciona un torneo para crear grupo.')
      await createGroup({
        tournamentId,
        name: input.name,
        groupCategoryId: input.groupCategoryId,
      })
    },
    onSuccess: async () => {
      toast.success('Grupo creado')
      await refreshGroups()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al crear grupo'),
  })

  const categoryMut = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: async () => {
      toast.success('Categorías actualizadas')
      await Promise.all([
        refreshCategories(),
        qc.invalidateQueries({ queryKey: ['admin-groups'] }),
      ])
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Error al guardar categoría'),
  })

  const generateMut = useMutation({
    mutationFn: async (input: { group: AdminGroupRecord; mode: GenerateRrMode }) => {
      await generateRoundRobinMatches({
        tournamentId: input.group.tournament_id,
        groupId: input.group.id,
        players: input.group.players,
        createdBy: currentUserId,
        mode: input.mode,
      })
    },
    onSuccess: async (_, input) => {
      toast.success(input.mode === 'reset' ? 'Cruces regenerados' : 'Cruces faltantes generados')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-groups'] }),
        qc.invalidateQueries({ queryKey: ['admin-matches'] }),
        qc.invalidateQueries({ queryKey: ['matches', input.group.id] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al generar cruces'),
  })

  useEffect(() => {
    setCategoryFilter('all')
  }, [tournamentId])

  const filteredGroups = useMemo(() => {
    let list = (groupsQ.data ?? []).filter(
      (group) => tournamentId === 'all' || group.tournament_id === tournamentId,
    )
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'none') {
        list = list.filter((g) => !g.group_category_id)
      } else {
        list = list.filter((g) => g.group_category_id === categoryFilter)
      }
    }
    return list
  }, [groupsQ.data, tournamentId, categoryFilter])

  return (
    <div className="space-y-8 sm:space-y-10">
      <AdminPageHeader
        eyebrow="Administración"
        title="Grupos"
        description="Crea grupos, asigna jugadores, genera cruces y revisa el estado de cada bloque del torneo."
        actions={
          <CreateGroupModal
            tournamentId={tournamentId}
            categories={categories}
            onCreate={(name, groupCategoryId) => createMut.mutate({ name, groupCategoryId })}
          />
        }
      />

      <section className="space-y-4" aria-labelledby="groups-toolbar-heading">
        <AdminSectionTitle
          id="groups-toolbar-heading"
          title="Filtros"
          description="Enfoca un torneo para crear grupos o revisar los existentes."
        />
        <AdminToolbar className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="w-full min-w-0 space-y-2 sm:max-w-md lg:flex-1">
            <Label className="text-xs font-medium text-slate-600">Torneo</Label>
            <Select value={tournamentId} onValueChange={(value) => setTournamentId(value ?? 'all')}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Torneo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los torneos</SelectItem>
                {(tournamentsQ.data ?? []).map((tournament) => (
                  <SelectItem key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 space-y-2 sm:max-w-xs">
            <Label className="text-xs font-medium text-slate-600">Filtrar por categoría</Label>
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value ?? 'all')}
              disabled={tournamentId === 'all'}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </AdminToolbar>
      </section>

      {tournamentId !== 'all' ? (
        <section className="space-y-4" aria-labelledby="group-categories-heading">
          <AdminSectionTitle
            id="group-categories-heading"
            title="Categorías de grupo"
            description="Clasifica los bloques del torneo (p. ej. divisiones). Las tres por defecto se crean al abrir este torneo por primera vez."
          />
          {categoriesQ.isLoading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : (
            <GroupCategoriesPanel
              categories={categories}
              disabled={categoryMut.isPending}
              onAdd={(name) =>
                categoryMut.mutate(() =>
                  createGroupCategory({ tournamentId, name }).then(() => undefined),
                )
              }
              onRename={(id, name) =>
                categoryMut.mutate(() => updateGroupCategory(id, { name }).then(() => undefined))
              }
              onReorder={(id, order_index) =>
                categoryMut.mutate(() =>
                  updateGroupCategory(id, { order_index }).then(() => undefined),
                )
              }
              onDelete={(id) =>
                categoryMut.mutate(() => deleteGroupCategory(id).then(() => undefined))
              }
            />
          )}
        </section>
      ) : null}

      <section className="space-y-4" aria-labelledby="groups-grid-heading">
        <AdminSectionTitle id="groups-grid-heading" title="Grupos del torneo" description="Tarjetas con estado y acceso a gestión detallada." />

      {groupsQ.isError ? (
        <AdminEmptyState
          title="No se pudieron cargar los grupos."
          description={groupsQ.error instanceof Error ? groupsQ.error.message : 'Revisa permisos o conexión con Supabase.'}
          icon={Flag}
        />
      ) : groupsQ.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <AdminEmptyState
          title="Aún no hay grupos creados."
          description="Crea el primer grupo para comenzar a organizar el torneo."
          icon={Flag}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredGroups.map((group) => (
            <GroupAdminCard
              key={group.id}
              group={group}
              onManage={(nextGroup) => {
                setManagedGroup(nextGroup)
                setManagerOpen(true)
              }}
            />
          ))}
        </div>
      )}
      </section>

      <GroupPlayerManager
        group={managedGroup}
        categories={categoriesForManager}
        profiles={profilesQ.data ?? []}
        open={managerOpen}
        onOpenChange={setManagerOpen}
        onSaveGroupDetails={(groupId, patch) =>
          actionMut.mutate(() => updateGroup(groupId, patch))
        }
        onAssign={(input) => actionMut.mutate(() => assignPlayerToGroup(input).then(() => undefined))}
        onRemove={(groupPlayerId) => actionMut.mutate(() => removePlayerFromGroup(groupPlayerId))}
        onGenerateMatches={(group, mode) => generateMut.mutate({ group, mode })}
        currentUserId={currentUserId}
      />
    </div>
  )
}
