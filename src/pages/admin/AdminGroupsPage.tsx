import { Flag, LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { GroupAdminCard } from '@/components/admin/groups/GroupAdminCard'
import { GroupPlayerManager } from '@/components/admin/groups/GroupPlayerManager'
import { TournamentRoundRobinBulkCard } from '@/components/admin/groups/TournamentRoundRobinBulkCard'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
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
import { assignPlayerToGroup, deleteGroup, getAdminGroupsForTournament, removePlayerFromGroup, updateGroup, type AdminGroupRecord } from '@/services/admin'
import {
  createGroupCategory,
  deleteGroupCategory,
  ensureDefaultGroupCategories,
  listGroupCategories,
  updateGroupCategory,
} from '@/services/groupCategories'
import { createGroup, createMissingGroupsOnePerCategory } from '@/services/groups'
import { generateRoundRobinMatches, type GenerateRrMode } from '@/services/matches'
import { listProfilesForAdmin } from '@/services/profiles'
import { listTournaments } from '@/services/tournaments'
import type { GroupCategory } from '@/types/database'
import { useAuthStore } from '@/stores/authStore'

/** Placeholder controlado hasta que `useEffect` asigne el torneo por defecto (evita `value={undefined}` → warning de modo mixto). */
const ADMIN_GROUPS_TOURNAMENT_PENDING = '__admin_groups_tournament_pending__'

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
  tournamentId: string | null
  categories: GroupCategory[]
  onCreate: (name: string, groupCategoryId: string | null) => void
}) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<string>('none')

  return (
    <AdminFormModal
      trigger={
        <Button className="w-full sm:w-auto" disabled={!tournamentId}>
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [tournamentId, setTournamentId] = useState<string | null>(null)
  const [managedGroup, setManagedGroup] = useState<AdminGroupRecord | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)
  const managedGroupIdRef = useRef<string | null>(null)

  useEffect(() => {
    managedGroupIdRef.current = managedGroup?.id ?? null
  }, [managedGroup?.id])

  useEffect(() => {
    setManagedGroup(null)
    setManagerOpen(false)
  }, [tournamentId])

  const groupsQ = useQuery({
    queryKey: ['admin-groups', tournamentId],
    queryFn: () => getAdminGroupsForTournament(tournamentId!),
    enabled: Boolean(tournamentId),
  })
  const profilesQ = useQuery({ queryKey: ['profiles-admin'], queryFn: listProfilesForAdmin })
  const tournamentsQ = useQuery({ queryKey: ['admin-tournaments'], queryFn: listTournaments })

  useEffect(() => {
    const list = tournamentsQ.data
    if (!list?.length) return
    setTournamentId((prev) => {
      if (prev && list.some((t) => t.id === prev)) return prev
      const active = list.find((t) => t.status === 'active')
      return active?.id ?? list[0].id
    })
  }, [tournamentsQ.data])

  useEffect(() => {
    const fromUrl = searchParams.get('tournament')
    const list = tournamentsQ.data
    if (!fromUrl || !list?.length) return
    if (list.some((t) => t.id === fromUrl)) {
      setTournamentId(fromUrl)
    }
  }, [searchParams, tournamentsQ.data])

  const categoriesQ = useQuery({
    queryKey: ['group-categories', tournamentId],
    queryFn: async () => {
      await ensureDefaultGroupCategories(tournamentId!)
      return listGroupCategories(tournamentId!)
    },
    enabled: Boolean(tournamentId),
  })

  const categories = categoriesQ.data ?? []

  const modalGroupCategoriesQ = useQuery({
    queryKey: ['group-categories', 'manager', managedGroup?.tournament_id],
    queryFn: async () => {
      const tid = managedGroup!.tournament_id
      await ensureDefaultGroupCategories(tid)
      return listGroupCategories(tid)
    },
    enabled: Boolean(managerOpen && managedGroup?.tournament_id),
    staleTime: 15_000,
  })

  const categoriesForManager = modalGroupCategoriesQ.data ?? []
  const categoriesLoadingForManager = modalGroupCategoriesQ.isFetching && categoriesForManager.length === 0

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
    await qc.invalidateQueries({ queryKey: ['group-categories'] })
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
      if (!tournamentId) throw new Error('Selecciona un torneo para crear grupo.')
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

  const bulkGroupsByCategoryMut = useMutation({
    mutationFn: async () => {
      if (!tournamentId) throw new Error('Selecciona un torneo para crear grupos.')
      if (categories.length === 0) throw new Error('No hay categorías de grupo en este torneo.')
      const existingGroups = groupsQ.data ?? []
      return createMissingGroupsOnePerCategory({
        tournamentId,
        categories,
        existingGroups: existingGroups.map((g) => ({
          order_index: g.order_index,
          group_category_id: g.group_category_id,
        })),
      })
    },
    onSuccess: async ({ created }) => {
      if (created === 0) {
        toast.message('Cada categoría ya tiene al menos un grupo', {
          description: 'No era necesario crear filas nuevas.',
        })
      } else {
        toast.success(
          created === 1 ? 'Se creó 1 grupo en una categoría vacía.' : `Se crearon ${created} grupos (uno por categoría vacía).`,
        )
      }
      await refreshGroups()
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Error al crear grupos por categoría'),
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

  const deleteGroupMut = useMutation({
    mutationFn: (groupId: string) => deleteGroup(groupId),
    onSuccess: async (_, groupId) => {
      toast.success('Grupo eliminado')
      if (managedGroupIdRef.current === groupId) {
        setManagedGroup(null)
        setManagerOpen(false)
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-groups'] }),
        qc.invalidateQueries({ queryKey: ['admin-matches'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
        qc.invalidateQueries({ queryKey: ['admin-results'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard-options'] }),
        qc.invalidateQueries({ queryKey: ['matches'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el grupo'),
  })

  const groupsInTournament = useMemo(() => groupsQ.data ?? [], [groupsQ.data])

  return (
    <div className="space-y-8 sm:space-y-10">
      <AdminPageHeader
        eyebrow="Administración"
        title="Grupos"
        description="Crea grupos, asigna jugadores, genera cruces y revisa el estado de cada bloque del torneo."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            {(tournamentsQ.data ?? []).length > 0 ? (
              <Select
                value={tournamentId ?? ADMIN_GROUPS_TOURNAMENT_PENDING}
                onValueChange={(value) => {
                  if (!value || value === ADMIN_GROUPS_TOURNAMENT_PENDING) return
                  setTournamentId(value)
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev)
                    next.set('tournament', value)
                    return next
                  })
                }}
              >
                <SelectTrigger className="h-11 w-full min-w-[12rem] sm:w-[min(100%,16rem)]">
                  <SelectValue placeholder="Torneo" />
                </SelectTrigger>
                <SelectContent>
                  {!tournamentId ? (
                    <SelectItem
                      value={ADMIN_GROUPS_TOURNAMENT_PENDING}
                      disabled
                      className="pointer-events-none text-muted-foreground opacity-80"
                    >
                      Preparando torneo…
                    </SelectItem>
                  ) : null}
                  {(tournamentsQ.data ?? []).map((tournament) => (
                    <SelectItem key={tournament.id} value={tournament.id}>
                      {tournament.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button
              type="button"
              variant="outline"
              title="Crea un grupo vacío en cada categoría que aún no tenga ninguno. Nombre: «Categoría — Grupo 1» (igual que en el asistente de siguiente torneo)."
              className="w-full sm:w-auto"
              disabled={
                !tournamentId ||
                categoriesQ.isLoading ||
                categories.length === 0 ||
                bulkGroupsByCategoryMut.isPending ||
                createMut.isPending
              }
              onClick={() => bulkGroupsByCategoryMut.mutate()}
            >
              <LayoutGrid className="size-4" />
              Todos los grupos por categoría
            </Button>
            <CreateGroupModal
              tournamentId={tournamentId}
              categories={categories}
              onCreate={(name, groupCategoryId) => createMut.mutate({ name, groupCategoryId })}
            />
          </div>
        }
      />

      {tournamentId ? (
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

      {tournamentId && groupsInTournament.length > 0 ? (
        <section className="space-y-4" aria-labelledby="bulk-rr-heading">
          <AdminSectionTitle
            id="bulk-rr-heading"
            title="Cruces round-robin masivos"
            description="Genera o completa la distribución de partidos para todos los grupos del torneo seleccionado, según modo y alcance."
          />
          <TournamentRoundRobinBulkCard
            tournamentId={tournamentId}
            groups={groupsQ.data ?? []}
            currentUserId={currentUserId}
            disabled={groupsQ.isLoading || generateMut.isPending}
            variant="admin"
          />
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
      ) : tournamentsQ.isSuccess && (tournamentsQ.data ?? []).length === 0 ? (
        <AdminEmptyState
          title="No hay torneos."
          description="Crea un torneo desde administración para poder organizar grupos."
          icon={Flag}
        />
      ) : !tournamentId ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : groupsInTournament.length === 0 ? (
        <AdminEmptyState
          title="Aún no hay grupos creados."
          description="Usa «Todos los grupos por categoría» para crear uno por cada división, o crea un grupo a mano."
          icon={Flag}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groupsInTournament.map((group) => (
            <GroupAdminCard
              key={group.id}
              group={group}
              onManage={(nextGroup) => {
                setManagedGroup(nextGroup)
                setManagerOpen(true)
              }}
              onDelete={(g) => deleteGroupMut.mutate(g.id)}
              isDeleting={deleteGroupMut.isPending && deleteGroupMut.variables === group.id}
            />
          ))}
        </div>
      )}
      </section>

      <GroupPlayerManager
        group={managedGroup}
        categories={categoriesForManager}
        categoriesLoading={categoriesLoadingForManager}
        profiles={profilesQ.data ?? []}
        open={managerOpen}
        onOpenChange={setManagerOpen}
        onSaveGroupDetails={(groupId, patch) =>
          actionMut.mutate(() => updateGroup(groupId, patch))
        }
        onAssign={(input) =>
          actionMut.mutate(async () => {
            await assignPlayerToGroup(input)
            const groupWillBeComplete = managedGroup && managedGroup.players.length + 1 === managedGroup.max_players
            if (groupWillBeComplete) {
              toast.success('Grupo completo. Partidos generados correctamente.')
            } else if (managedGroup) {
              toast.info(`Agrega ${managedGroup.max_players} jugadores para generar partidos.`)
            }
          })
        }
        onRemove={(groupPlayerId) => actionMut.mutate(() => removePlayerFromGroup(groupPlayerId))}
        onGenerateMatches={(group, mode) => generateMut.mutate({ group, mode })}
        currentUserId={currentUserId}
      />
    </div>
  )
}
