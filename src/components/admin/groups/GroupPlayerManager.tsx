import { Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
import { GroupMatchScheduleList } from '@/components/tournaments/GroupMatchScheduleList'
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
import type { AdminGroupRecord } from '@/services/admin'
import type { GenerateRrMode } from '@/services/matches'
import type { Profile } from '@/types/database'

export function GroupPlayerManager({
  group,
  profiles,
  open,
  onOpenChange,
  onAssign,
  onRemove,
  onRename,
  onGenerateMatches,
  currentUserId,
}: {
  group: AdminGroupRecord | null
  profiles: Profile[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssign: (input: { groupId: string; userId: string; displayName: string; seedOrder?: number }) => void
  onRemove: (groupPlayerId: string) => void
  onRename: (groupId: string, name: string) => void
  onGenerateMatches: (group: AdminGroupRecord, mode: GenerateRrMode) => void
  currentUserId: string | null
}) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [seedOrder, setSeedOrder] = useState(0)

  const availableProfiles = useMemo(() => {
    const currentIds = new Set(group?.players.map((player) => player.user_id) ?? [])
    return profiles.filter((profile) => profile.role === 'player' && !currentIds.has(profile.id))
  }, [group, profiles])

  if (!group) return null

  const isFull = group.players.length >= group.max_players

  return (
    <AdminFormModal
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="w-[calc(100%-1.5rem)] max-w-[min(100vw-1.5rem,42rem)] sm:max-w-2xl"
      title={`Gestionar ${group.name}`}
      description="Edita el nombre, asigna jugadores, genera cruces y agenda la ventana de captura."
    >
      <div className="space-y-8 sm:space-y-9">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            const nextName = String(formData.get('name') ?? '').trim()
            onRename(group.id, nextName || group.name)
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="group-name">Nombre del grupo</Label>
            <Input id="group-name" name="name" defaultValue={group.name} />
          </div>
          <Button type="submit" className="w-full shrink-0 sm:w-auto">
            Guardar
          </Button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-[#E2E8F0]">
          {group.players.length === 0 ? (
            <p className="p-5 text-sm text-[#64748B] sm:p-6">Aún no hay jugadores asignados.</p>
          ) : (
            group.players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3.5 last:border-b-0 sm:px-5 sm:py-4"
              >
                <div>
                  <p className="text-sm font-medium text-[#102A43]">{player.display_name}</p>
                  <p className="text-xs text-[#64748B]">{player.profile?.email ?? 'Sin email'}</p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => onRemove(player.id)}>
                  <Trash2 className="size-4" />
                  <span className="sr-only">Remover jugador</span>
                </Button>
              </div>
            ))
          )}
        </div>

        <form
          className="space-y-4 rounded-2xl bg-[#F8FAFC] p-5 sm:space-y-4 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (!selectedUserId) return
            const profile = profiles.find((item) => item.id === selectedUserId)
            onAssign({
              groupId: group.id,
              userId: selectedUserId,
              displayName: displayName || profile?.full_name || profile?.email || 'Jugador',
              seedOrder,
            })
            setSelectedUserId('')
            setDisplayName('')
            setSeedOrder(0)
          }}
        >
          <div className="flex items-center justify-between gap-2 pb-0.5">
            <Label>Asignar jugador</Label>
            <span className="text-xs text-[#64748B]">
              {group.players.length} / {group.max_players}
            </span>
          </div>
          <Select value={selectedUserId} onValueChange={(value) => setSelectedUserId(value ?? '')} disabled={isFull}>
            <SelectTrigger>
              <SelectValue placeholder={isFull ? 'Grupo completo' : 'Selecciona jugador'} />
            </SelectTrigger>
            <SelectContent>
              {availableProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name ?? profile.email ?? 'Jugador'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Nombre visible opcional"
            disabled={isFull}
          />
          <Input
            type="number"
            value={seedOrder}
            onChange={(event) => setSeedOrder(Number(event.target.value))}
            placeholder="Seed"
            disabled={isFull}
          />
          <Button type="submit" className="mt-1" disabled={isFull || !selectedUserId}>
            Asignar jugador
          </Button>
        </form>

        <div className="space-y-4 rounded-2xl border border-[#E2E8F0] p-5 sm:p-6">
          <div>
            <h3 className="text-sm font-semibold text-[#102A43]">Cruces round-robin</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#64748B] sm:mt-2.5">
              Genera los partidos del grupo desde el dashboard admin. Usa regenerar solo si quieres borrar cruces previos.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="secondary"
              disabled={group.players.length < 2}
              onClick={() => onGenerateMatches(group, 'fill')}
            >
              Generar faltantes
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={group.players.length < 2}
              onClick={() => onGenerateMatches(group, 'reset')}
            >
              Regenerar cruces
            </Button>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-[#E2E8F0] p-5 sm:p-6">
          <div>
            <h3 className="text-sm font-semibold text-[#102A43]">Agenda y captura</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#64748B] sm:mt-2.5">
              Define hora de fin y cancha para habilitar la captura de marcador por jugadores.
            </p>
          </div>
          <GroupMatchScheduleList
            groupId={group.id}
            tournamentId={group.tournament_id}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </AdminFormModal>
  )
}
