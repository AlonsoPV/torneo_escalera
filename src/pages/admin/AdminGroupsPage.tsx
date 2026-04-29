import { Flag, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { GroupAdminCard } from '@/components/admin/groups/GroupAdminCard'
import { GroupPlayerManager } from '@/components/admin/groups/GroupPlayerManager'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminFilterCard } from '@/components/admin/shared/AdminFilterCard'
import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
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
import { createGroup } from '@/services/groups'
import { generateRoundRobinMatches, type GenerateRrMode } from '@/services/matches'
import { listProfilesForAdmin } from '@/services/profiles'
import { listTournaments } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'

function CreateGroupModal({
  tournamentId,
  onCreate,
}: {
  tournamentId: string
  onCreate: (name: string) => void
}) {
  const [name, setName] = useState('')

  return (
    <AdminFormModal
      trigger={
        <Button className="w-full sm:w-auto" disabled={!tournamentId || tournamentId === 'all'}>
          <Plus className="size-4" />
          Crear grupo
        </Button>
      }
      title="Crear grupo"
      description="Los grupos admiten hasta 5 jugadores."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onCreate(name)
          setName('')
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="group-create-name">Nombre del grupo</Label>
          <Input id="group-create-name" value={name} onChange={(event) => setName(event.target.value)} required />
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
  const [managedGroup, setManagedGroup] = useState<AdminGroupRecord | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)

  const groupsQ = useQuery({ queryKey: ['admin-groups'], queryFn: () => getAdminGroups() })
  const profilesQ = useQuery({ queryKey: ['profiles-admin'], queryFn: listProfilesForAdmin })
  const tournamentsQ = useQuery({ queryKey: ['admin-tournaments'], queryFn: listTournaments })

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

  const actionMut = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: async () => {
      toast.success('Grupo actualizado')
      await refreshGroups()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al actualizar grupo'),
  })

  const createMut = useMutation({
    mutationFn: async (name: string) => {
      if (tournamentId === 'all') throw new Error('Selecciona un torneo para crear grupo.')
      await createGroup({ tournamentId, name })
    },
    onSuccess: async () => {
      toast.success('Grupo creado')
      await refreshGroups()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al crear grupo'),
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

  const filteredGroups = useMemo(
    () =>
      (groupsQ.data ?? []).filter((group) => tournamentId === 'all' || group.tournament_id === tournamentId),
    [groupsQ.data, tournamentId],
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Grupos"
        title="Gestión de grupos"
        description="Crea grupos, asigna jugadores y valida rápidamente qué grupos están completos."
        actions={<CreateGroupModal tournamentId={tournamentId} onCreate={(name) => createMut.mutate(name)} />}
      />

      <AdminFilterCard>
        <Label className="mb-2 block text-sm font-medium text-[#102A43]">Filtrar por torneo</Label>
        <Select value={tournamentId} onValueChange={(value) => setTournamentId(value ?? 'all')}>
          <SelectTrigger className="w-full">
            <SelectValue />
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
      </AdminFilterCard>

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

      <GroupPlayerManager
        group={managedGroup}
        profiles={profilesQ.data ?? []}
        open={managerOpen}
        onOpenChange={setManagerOpen}
        onRename={(groupId, name) => actionMut.mutate(() => updateGroup(groupId, { name }))}
        onAssign={(input) => actionMut.mutate(() => assignPlayerToGroup(input).then(() => undefined))}
        onRemove={(groupPlayerId) => actionMut.mutate(() => removePlayerFromGroup(groupPlayerId))}
        onGenerateMatches={(group, mode) => generateMut.mutate({ group, mode })}
        currentUserId={currentUserId}
      />
    </div>
  )
}
