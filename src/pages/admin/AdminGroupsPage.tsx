import { Flag, LayoutGrid, Pencil, Plus, Shuffle, Trash2, UserCheck, UsersRound } from 'lucide-react'
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
import {
  bulkAssignPlayersToIncompleteGroups,
  bulkCreateNamedGroupsFromPlayerPool,
  chunkProfilesForNewGroups,
  profileLabelForDistribution,
  sortAdminGroupsForDistribution,
} from '@/services/adminGroupQuickDistribution'
import {
  applyDraftTournamentRebalance,
  previewDraftTournamentRebalance,
  publishDraftTournament,
  recordDraftPlayerRemoval,
} from '@/services/draftTournamentAdjustments'
import { createGroup, createMissingGroupsOnePerCategory } from '@/services/groups'
import { generateRoundRobinMatches, type GenerateRrMode } from '@/services/matches'
import { listProfilesForAdmin } from '@/services/profiles'
import { listTournaments } from '@/services/tournaments'
import type { GroupCategory } from '@/types/database'
import { useAuthStore } from '@/stores/authStore'

/** Placeholder controlado hasta que `useEffect` asigne el torneo por defecto (evita `value={undefined}` → warning de modo mixto). */
const ADMIN_GROUPS_TOURNAMENT_PENDING = '__admin_groups_tournament_pending__'

function FreePlayersPanel({
  freeCount,
  incompleteCount,
  fillSlots,
  createGroupCount,
  disabled,
  isFilling,
  isCreating,
  onFillIncomplete,
  onCreateGroups,
}: {
  freeCount: number
  incompleteCount: number
  fillSlots: number
  createGroupCount: number
  disabled?: boolean
  isFilling?: boolean
  isCreating?: boolean
  onFillIncomplete: () => void
  onCreateGroups: () => void
}) {
  const canFill = freeCount > 0 && fillSlots > 0
  const canCreate = freeCount >= 2
  const busy = Boolean(isFilling || isCreating)

  return (
    <section className="overflow-hidden rounded-2xl border border-[#D7E2DD] bg-white shadow-sm">
      <div className="flex flex-col lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E7F4EE] text-[#1F5A4C]">
              <UsersRound className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-[#102A43]">
                Jugadores libres y armado de grupos
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#64748B]">
                Primero rellena cupos abiertos. Si sobran jugadores, crea grupos nuevos y deja sus cruces listos en el
                mismo flujo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="min-w-0 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Libres</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#102A43]">{freeCount}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Incompletos</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#102A43]">{incompleteCount}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Cupos</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#102A43]">{fillSlots}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Grupos nuevos</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#102A43]">{createGroupCount}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#FCFDFD] px-3 py-2 text-xs leading-relaxed text-[#475569]">
            {freeCount === 0
              ? 'No hay jugadores libres pendientes de asignar en este torneo.'
              : canFill
                ? `Recomendación: rellena hasta ${Math.min(freeCount, fillSlots)} cupo(s) antes de crear grupos nuevos; si tras eso siguen incompletos, usa más abajo «Distribución masiva» para los cruces faltantes (2–5 jugadores por grupo).`
                : 'No hay cupos abiertos: crea grupos nuevos para los jugadores libres. Revisa después la distribución masiva si faltaran partidos en algún grupo.'}
          </div>
        </div>

        <div className="w-full shrink-0 border-t border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:p-5 lg:w-[22rem] lg:border-l lg:border-t-0">
          <div className="grid gap-2">
            <Button
              type="button"
              className="h-10 w-full gap-2 bg-[#1F5A4C] hover:bg-[#174a3f]"
              disabled={disabled || !canFill || busy}
              onClick={onFillIncomplete}
            >
              <UserCheck className="size-4" aria-hidden />
              {isFilling ? 'Rellenando...' : 'Rellenar incompletos'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full gap-2 border-[#BED4CA] bg-white"
              disabled={disabled || !canCreate || busy}
              onClick={onCreateGroups}
            >
              <Shuffle className="size-4" aria-hidden />
              {isCreating ? 'Creando...' : 'Crear grupos y partidos'}
            </Button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#64748B]">
            {freeCount === 1
              ? 'Se necesitan al menos 2 jugadores libres para crear un grupo con partidos.'
              : 'Operación rápida: asigna jugadores, completa cupos y crea RR con la misma lógica que «Distribución de cruces», sin repetir trabajo grupo por grupo.'}
          </p>
        </div>
      </div>
    </section>
  )
}

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

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name, 'es')),
    [categories],
  )

  return (
    <div className="overflow-hidden rounded-xl border border-border/20 bg-background">
      <form
        className="flex flex-col gap-2 border-b border-border/20 p-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = newName.trim()
          if (!trimmed) return
          onAdd(trimmed)
          setNewName('')
        }}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="new-category-name" className="text-xs text-muted-foreground">
            Nueva categoría
          </Label>
          <Input
            id="new-category-name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Ej. Sub-17"
            disabled={disabled}
            className="h-9"
          />
        </div>
        <Button type="submit" size="sm" className="w-full shrink-0 sm:w-auto" disabled={disabled || !newName.trim()}>
          <Plus className="size-4" />
          Añadir
        </Button>
      </form>
      {categories.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No hay categorías. Añade la primera arriba.</p>
      ) : (
        <div className="space-y-1.5 p-3">
          {sortedCategories.map((category) =>
            editingId === category.id ? (
              <div
                key={category.id}
                className="flex flex-col gap-2 rounded-lg border border-border/20 bg-muted/30 px-3 py-2 sm:flex-row sm:items-end"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Nombre</Label>
                  <Input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    disabled={disabled}
                    className="h-9"
                  />
                </div>
                <div className="flex gap-2">
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
                  <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setEditingId(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={category.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/20 bg-muted/50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{category.name}</p>
                  <p className="text-xs text-muted-foreground">Orden {category.order_index}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Input
                    type="number"
                    className="h-8 w-14 px-1 text-center text-xs"
                    defaultValue={category.order_index}
                    disabled={disabled}
                    title="Orden de visualización"
                    key={`${category.id}-${category.order_index}`}
                    onBlur={(event) => {
                      const next = Number(event.target.value)
                      if (Number.isFinite(next) && next !== category.order_index) {
                        onReorder(category.id, next)
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                    disabled={disabled}
                    onClick={() => {
                      setEditingId(category.id)
                      setEditName(category.name)
                    }}
                    aria-label="Renombrar categoría"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 disabled:opacity-50"
                    disabled={disabled}
                    onClick={() => {
                      if (
                        typeof window !== 'undefined' &&
                        window.confirm('¿Eliminar esta categoría? Los grupos quedarán sin categoría.')
                      ) {
                        onDelete(category.id)
                      }
                    }}
                    aria-label="Eliminar categoría"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
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
            <SelectTrigger className="h-11 min-w-[180px] w-full">
              <SelectValue placeholder="Sin categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" label="Sin categoría">
                Sin categoría
              </SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id} label={c.name}>
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

function DraftTournamentAdjustmentsPanel({
  tournamentId,
  isDraft,
  preview,
  loading,
  disabled,
  onPreview,
  onApply,
  onPublish,
}: {
  tournamentId: string | null
  isDraft: boolean
  preview: Awaited<ReturnType<typeof previewDraftTournamentRebalance>> | null
  loading: boolean
  disabled?: boolean
  onPreview: () => void
  onApply: () => void
  onPublish: () => void
}) {
  if (!tournamentId || !isDraft) return null

  const pendingIssues = preview?.balance.filter((row) => row.status !== 'ok') ?? []

  return (
    <section className="rounded-2xl border border-[#BED4CA] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1F5A4C]">
            Ajustes antes de publicar torneo
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#102A43]">Altas, bajas y rebalanceo</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#64748B]">
            Los jugadores agregados manualmente quedan fijos en su grupo. El rebalanceo solo mueve jugadores no fijos y
            deja el torneo listo para publicar con grupos de 5.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={disabled || loading} onClick={onPreview}>
            Vista previa
          </Button>
          <Button type="button" variant="secondary" disabled={disabled || loading || !preview || preview.moves.length === 0 || preview.conflicts.length > 0} onClick={onApply}>
            Rebalancear automáticamente
          </Button>
          <Button type="button" className="bg-[#1F5A4C] hover:bg-[#174a3f]" disabled={disabled || loading || !preview || pendingIssues.length > 0 || preview.conflicts.length > 0} onClick={onPublish}>
            Publicar torneo
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <p className="text-sm font-semibold text-[#102A43]">Balance de grupos</p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
              {preview.balance.map((row) => (
                <div key={row.groupId} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                  <span className="truncate font-medium text-[#102A43]">{row.groupName}</span>
                  <span className={row.status === 'ok' ? 'text-emerald-700' : row.status === 'missing_players' ? 'text-amber-700' : 'text-red-700'}>
                    {row.playerCount}/5
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <p className="text-sm font-semibold text-[#102A43]">Movimientos sugeridos</p>
            {preview.conflicts.length > 0 ? (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {preview.conflicts[0]}
              </div>
            ) : preview.moves.length === 0 ? (
              <p className="mt-2 text-sm text-[#64748B]">No hay movimientos pendientes.</p>
            ) : (
              <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-[#E2E8F0]">
                {preview.moves.map((move) => (
                  <div key={`${move.groupPlayerId}-${move.destinationGroupId}`} className="grid gap-1 border-b border-[#E2E8F0] px-3 py-2 text-sm last:border-b-0 sm:grid-cols-[1fr_0.8fr_0.8fr]">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#102A43]">{move.playerName}</p>
                      <p className="text-xs text-[#64748B]">{move.type === 'rebalance_up' ? 'Rebalanceo: sube' : 'Rebalanceo: baja'}</p>
                    </div>
                    <p className="text-xs text-[#64748B]">{move.currentGroupName}</p>
                    <p className="text-xs font-medium text-[#1F5A4C]">{move.destinationGroupName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#64748B]">
          Genera una vista previa para validar vacantes, excesos y conflictos antes de aplicar cambios.
        </p>
      )}
    </section>
  )
}

export function AdminGroupsPage() {
  const qc = useQueryClient()
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [tournamentId, setTournamentId] = useState<string | null>(null)
  const [managedGroup, setManagedGroup] = useState<AdminGroupRecord | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)
  const [draftPreview, setDraftPreview] = useState<Awaited<ReturnType<typeof previewDraftTournamentRebalance>> | null>(null)
  const managedGroupIdRef = useRef<string | null>(null)

  useEffect(() => {
    managedGroupIdRef.current = managedGroup?.id ?? null
  }, [managedGroup?.id])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setManagedGroup(null)
      setManagerOpen(false)
      setDraftPreview(null)
    }, 0)
    return () => window.clearTimeout(handle)
  }, [tournamentId])

  const groupsQ = useQuery({
    queryKey: ['admin-groups', tournamentId],
    queryFn: () => getAdminGroupsForTournament(tournamentId!),
    enabled: Boolean(tournamentId),
    staleTime: 60_000,
  })
  const profilesQ = useQuery({
    queryKey: ['profiles-admin'],
    queryFn: listProfilesForAdmin,
    enabled: Boolean(tournamentId),
    staleTime: 2 * 60_000,
  })
  const tournamentsQ = useQuery({
    queryKey: ['admin-tournaments'],
    queryFn: listTournaments,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    const list = tournamentsQ.data
    if (!list?.length) return
    const handle = window.setTimeout(() => {
      setTournamentId((prev) => {
        if (prev && list.some((t) => t.id === prev)) return prev
        const active = list.find((t) => t.status === 'active')
        return active?.id ?? list[0].id
      })
    }, 0)
    return () => window.clearTimeout(handle)
  }, [tournamentsQ.data])

  useEffect(() => {
    const fromUrl = searchParams.get('tournament')
    const list = tournamentsQ.data
    if (!fromUrl || !list?.length) return
    if (list.some((t) => t.id === fromUrl)) {
      const handle = window.setTimeout(() => setTournamentId(fromUrl), 0)
      return () => window.clearTimeout(handle)
    }
  }, [searchParams, tournamentsQ.data])

  const categoriesQ = useQuery({
    queryKey: ['group-categories', tournamentId],
    queryFn: async () => {
      await ensureDefaultGroupCategories(tournamentId!)
      return listGroupCategories(tournamentId!)
    },
    enabled: Boolean(tournamentId),
    staleTime: 10 * 60_000,
  })

  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data])

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
  const selectedTournament = useMemo(
    () => (tournamentsQ.data ?? []).find((tournament) => tournament.id === tournamentId) ?? null,
    [tournamentId, tournamentsQ.data],
  )

  useEffect(() => {
    if (!managedGroup) return
    const freshGroup = groupsQ.data?.find((group) => group.id === managedGroup.id)
    if (!freshGroup) return
    const handle = window.setTimeout(() => setManagedGroup(freshGroup), 0)
    return () => window.clearTimeout(handle)
  }, [groupsQ.data, managedGroup])

  const refreshGroups = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['admin-groups'] }),
      qc.invalidateQueries({ queryKey: ['admin-overview'] }),
    ])
  }

  const refreshDraftPreview = async () => {
    if (!tournamentId || selectedTournament?.status !== 'draft') {
      setDraftPreview(null)
      return
    }
    setDraftPreview(await previewDraftTournamentRebalance(tournamentId))
  }

  const refreshCategories = async () => {
    await qc.invalidateQueries({ queryKey: ['group-categories'] })
  }

  const actionMut = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: async () => {
      toast.success('Grupo actualizado')
      await refreshGroups()
      await refreshDraftPreview()
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

  const draftPreviewMut = useMutation({
    mutationFn: async () => {
      if (!tournamentId) throw new Error('Selecciona un torneo.')
      return previewDraftTournamentRebalance(tournamentId)
    },
    onSuccess: (preview) => setDraftPreview(preview),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo calcular el balance'),
  })

  const draftRebalanceMut = useMutation({
    mutationFn: async () => {
      if (!tournamentId) throw new Error('Selecciona un torneo.')
      if (!currentUserId) throw new Error('No se encontró el administrador actual.')
      return applyDraftTournamentRebalance({ tournamentId, adminId: currentUserId })
    },
    onSuccess: async ({ movesApplied }) => {
      toast.success(movesApplied === 1 ? 'Se aplicó 1 movimiento.' : `Se aplicaron ${movesApplied} movimientos.`)
      await refreshGroups()
      await refreshDraftPreview()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo rebalancear el torneo'),
  })

  const publishDraftMut = useMutation({
    mutationFn: async () => {
      if (!tournamentId) throw new Error('Selecciona un torneo.')
      return publishDraftTournament({ tournamentId, adminId: currentUserId })
    },
    onSuccess: async ({ matchesInserted }) => {
      toast.success(`Torneo publicado. Se generaron ${matchesInserted} partido(s).`)
      setDraftPreview(null)
      await Promise.all([
        refreshGroups(),
        qc.invalidateQueries({ queryKey: ['admin-tournaments'] }),
        qc.invalidateQueries({ queryKey: ['tournaments'] }),
        qc.invalidateQueries({ queryKey: ['admin-matches'] }),
        qc.invalidateQueries({ queryKey: ['matches'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo publicar el torneo'),
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

  const assignedUserIdsInTournament = useMemo(() => {
    const ids = new Set<string>()
    for (const group of groupsInTournament) {
      for (const player of group.players) ids.add(player.user_id)
    }
    return ids
  }, [groupsInTournament])

  const freePlayers = useMemo(
    () =>
      (profilesQ.data ?? [])
        .filter((profile) => profile.role === 'player' && profile.status !== 'inactive' && !assignedUserIdsInTournament.has(profile.id))
        .sort((a, b) =>
          profileLabelForDistribution(a).localeCompare(profileLabelForDistribution(b), 'es', {
            numeric: true,
            sensitivity: 'base',
          }),
        ),
    [assignedUserIdsInTournament, profilesQ.data],
  )

  const incompleteGroups = useMemo(
    () =>
      groupsInTournament
        .filter((group) => group.players.length > 0 && group.players.length < (group.max_players ?? 5))
        .sort(sortAdminGroupsForDistribution),
    [groupsInTournament],
  )

  const freeSlotsInIncompleteGroups = useMemo(
    () =>
      incompleteGroups.reduce(
        (sum, group) => sum + Math.max(0, (group.max_players ?? 5) - group.players.length),
        0,
      ),
    [incompleteGroups],
  )

  const estimatedNewGroupsForFreePlayers = chunkProfilesForNewGroups(freePlayers, 5).filter((chunk) => chunk.length >= 2)
    .length

  const fillIncompleteGroupsMut = useMutation({
    mutationFn: async () => {
      if (!tournamentId) throw new Error('Selecciona un torneo.')
      if (freePlayers.length === 0) throw new Error('No hay jugadores libres para asignar.')
      if (incompleteGroups.length === 0) throw new Error('No hay grupos incompletos con cupo disponible.')

      return bulkAssignPlayersToIncompleteGroups({
        incompleteGroupsSorted: incompleteGroups,
        queue: freePlayers,
        label: profileLabelForDistribution,
      })
    },
    onSuccess: async ({ assigned }) => {
      toast.success(`Se asignaron ${assigned} jugador(es) a grupos incompletos.`)
      await Promise.all([
        refreshGroups(),
        qc.invalidateQueries({ queryKey: ['admin-matches'] }),
        qc.invalidateQueries({ queryKey: ['matches'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudieron rellenar los grupos'),
  })

  const createGroupsForFreePlayersMut = useMutation({
    mutationFn: async () => {
      if (!tournamentId) throw new Error('Selecciona un torneo.')
      if (freePlayers.length === 0) throw new Error('No hay jugadores libres para agrupar.')
      if (freePlayers.length < 2) throw new Error('Se necesitan al menos 2 jugadores libres para crear partidos.')

      const nextOrder =
        groupsInTournament.length === 0
          ? 0
          : Math.max(...groupsInTournament.map((group) => group.order_index ?? 0), 0) + 1

      return bulkCreateNamedGroupsFromPlayerPool({
        tournamentId,
        startingGroupTitleNumber: groupsInTournament.length + 1,
        startingOrderIndex: nextOrder,
        freePlayers,
        label: profileLabelForDistribution,
        createdBy: currentUserId,
      })
    },
    onSuccess: async ({ createdGroups, assignedPlayers, roundRobinMatchesInserted }) => {
      toast.success(
        `Listo: ${createdGroups} grupo(s), ${assignedPlayers} jugador(es) y ${roundRobinMatchesInserted} partido(s) nuevos (round-robin, mismas reglas que la distribución masiva).`,
      )
      await Promise.all([
        refreshGroups(),
        qc.invalidateQueries({ queryKey: ['admin-matches'] }),
        qc.invalidateQueries({ queryKey: ['matches'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudieron crear grupos'),
  })

  /** Evita UUID en el trigger si Base UI no enlaza el ítem seleccionado. */
  const headerTournamentLabel = useMemo(() => {
    if (!tournamentId) return undefined
    return (tournamentsQ.data ?? []).find((t) => t.id === tournamentId)?.name
  }, [tournamentId, tournamentsQ.data])

  const groupSections = useMemo(() => {
    const sortedCats = [...categories].sort(
      (a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name, 'es'),
    )
    const sections: { key: string; label: string; groups: AdminGroupRecord[] }[] = []
    const assignedGroupIds = new Set<string>()
    for (const cat of sortedCats) {
      const g = groupsInTournament.filter((gr) => gr.group_category_id === cat.id)
      if (g.length > 0) {
        sections.push({ key: cat.id, label: cat.name, groups: g })
        for (const gr of g) assignedGroupIds.add(gr.id)
      }
    }
    const rest = groupsInTournament.filter((gr) => !assignedGroupIds.has(gr.id))
    if (rest.length > 0) {
      sections.push({ key: '__sin_categoria__', label: 'Sin categoría', groups: rest })
    }
    return sections
  }, [categories, groupsInTournament])

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
                <SelectTrigger className="h-11 min-w-[200px] max-w-[280px] w-auto">
                  <SelectValue placeholder="Selecciona un torneo">{headerTournamentLabel ?? undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {!tournamentId ? (
                    <SelectItem
                      value={ADMIN_GROUPS_TOURNAMENT_PENDING}
                      disabled
                      className="pointer-events-none text-muted-foreground opacity-80"
                      label="Preparando torneo…"
                    >
                      Preparando torneo…
                    </SelectItem>
                  ) : null}
                  {(tournamentsQ.data ?? []).map((tournament) => (
                    <SelectItem key={tournament.id} value={tournament.id} label={tournament.name}>
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
            <Skeleton className="h-36 rounded-xl border border-border/20" />
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

      {tournamentId ? (
        <DraftTournamentAdjustmentsPanel
          tournamentId={tournamentId}
          isDraft={selectedTournament?.status === 'draft'}
          preview={draftPreview}
          loading={draftPreviewMut.isPending || draftRebalanceMut.isPending || publishDraftMut.isPending}
          disabled={groupsQ.isLoading}
          onPreview={() => draftPreviewMut.mutate()}
          onApply={() => draftRebalanceMut.mutate()}
          onPublish={() => publishDraftMut.mutate()}
        />
      ) : null}

      {tournamentId && selectedTournament?.status !== 'draft' ? (
        <FreePlayersPanel
          freeCount={freePlayers.length}
          incompleteCount={incompleteGroups.length}
          fillSlots={freeSlotsInIncompleteGroups}
          createGroupCount={estimatedNewGroupsForFreePlayers}
          disabled={groupsQ.isLoading || profilesQ.isLoading || actionMut.isPending}
          isFilling={fillIncompleteGroupsMut.isPending}
          isCreating={createGroupsForFreePlayersMut.isPending}
          onFillIncomplete={() => fillIncompleteGroupsMut.mutate()}
          onCreateGroups={() => createGroupsForFreePlayersMut.mutate()}
        />
      ) : null}

      {tournamentId && selectedTournament?.status !== 'draft' && groupsInTournament.length > 0 ? (
        <section className="space-y-4" aria-labelledby="bulk-rr-heading">
          <AdminSectionTitle
            id="bulk-rr-heading"
            title="Distribución masiva round-robin"
            description="Genera o completa partidos en bloque (mismo motor que al crear grupos desde jugadores libres). Elige modo y alcance por cupo o por grupos con 2 a 5 jugadores."
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
        <AdminSectionTitle
          id="groups-grid-heading"
          title={
            groupsInTournament.length > 0
              ? `Grupos del torneo (${groupsInTournament.length})`
              : 'Grupos del torneo'
          }
          description="Tarjetas compactas por categoría; enlaces de texto para gestionar."
        />

      {groupsQ.isError ? (
        <AdminEmptyState
          title="No se pudieron cargar los grupos."
          description={groupsQ.error instanceof Error ? groupsQ.error.message : 'Revisa permisos o conexión con Supabase.'}
          icon={Flag}
        />
      ) : groupsQ.isLoading ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : tournamentsQ.isSuccess && (tournamentsQ.data ?? []).length === 0 ? (
        <AdminEmptyState
          title="No hay torneos."
          description="Crea un torneo desde administración para poder organizar grupos."
          icon={Flag}
        />
      ) : !tournamentId ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : groupsInTournament.length === 0 ? (
        <AdminEmptyState
          title="Aún no hay grupos creados."
          description="Usa «Todos los grupos por categoría» para crear uno por cada división, o crea un grupo a mano."
          icon={Flag}
        />
      ) : (
        <div className="space-y-6">
          {groupSections.map((section) => (
            <div key={section.key}>
              <p className="mb-2 pl-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {section.groups.map((group) => (
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
            </div>
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
            if (managedGroup?.tournament?.status === 'draft') {
              toast.success('Jugador fijo agregado al borrador.')
              return
            }
            const groupWillBeComplete = managedGroup && managedGroup.players.length + 1 === managedGroup.max_players
            if (groupWillBeComplete) {
              toast.success('Grupo completo. Partidos generados correctamente.')
            } else if (managedGroup) {
              toast.info(`Agrega ${managedGroup.max_players} jugadores para generar partidos.`)
            }
          })
        }
        onRemove={(groupPlayerId) =>
          actionMut.mutate(() =>
            managedGroup?.tournament?.status === 'draft' && currentUserId
              ? recordDraftPlayerRemoval({ groupPlayerId, adminId: currentUserId })
              : removePlayerFromGroup(groupPlayerId),
          )
        }
        onGenerateMatches={(group, mode) => generateMut.mutate({ group, mode })}
        currentUserId={currentUserId}
      />
    </div>
  )
}
