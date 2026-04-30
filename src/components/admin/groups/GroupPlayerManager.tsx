import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { GroupMatchScheduleList } from '@/components/tournaments/GroupMatchScheduleList'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import type { Group, GroupCategory, Profile } from '@/types/database'

const NONE = '__none__'

export function GroupPlayerManager({
  group,
  categories,
  profiles,
  open,
  onOpenChange,
  onAssign,
  onRemove,
  onSaveGroupDetails,
  onGenerateMatches,
  currentUserId,
}: {
  group: AdminGroupRecord | null
  categories: GroupCategory[]
  profiles: Profile[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssign: (input: { groupId: string; userId: string; displayName: string; seedOrder?: number }) => void
  onRemove: (groupPlayerId: string) => void
  onSaveGroupDetails: (
    groupId: string,
    patch: Partial<Pick<Group, 'name' | 'group_category_id'>>,
  ) => void
  onGenerateMatches: (group: AdminGroupRecord, mode: GenerateRrMode) => void
  currentUserId: string | null
}) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [seedOrder, setSeedOrder] = useState(0)
  const [categorySelect, setCategorySelect] = useState<string>(NONE)

  useEffect(() => {
    if (!group) {
      setCategorySelect(NONE)
      return
    }
    setCategorySelect(group.group_category_id ?? NONE)
  }, [group?.id, group?.group_category_id])

  const availableProfiles = useMemo(() => {
    const currentIds = new Set(group?.players.map((player) => player.user_id) ?? [])
    return profiles.filter((profile) => profile.role === 'player' && !currentIds.has(profile.id))
  }, [group, profiles])

  if (!group) return null

  const isFull = group.players.length >= group.max_players

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92vh,880px)] w-[min(calc(100vw-1rem),72rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogHeader className="shrink-0 space-y-2 border-b border-slate-200/80 px-5 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-6">
          <DialogTitle className="pr-8 text-lg text-[#102A43] sm:text-xl">Gestionar {group.name}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Edita datos del grupo, jugadores, cruces round-robin y la ventana de captura en un solo panel.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            <form
              className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6"
              onSubmit={(event) => {
                event.preventDefault()
                const formData = new FormData(event.currentTarget)
                const nextName = String(formData.get('name') ?? '').trim()
                onSaveGroupDetails(group.id, {
                  name: nextName || group.name,
                  group_category_id: categorySelect === NONE ? null : categorySelect,
                })
              }}
            >
              <div>
                <h3 className="text-sm font-semibold text-[#102A43]">Datos del grupo</h3>
                <p className="mt-1 text-xs text-[#64748B]">Nombre visible y categoría del torneo.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="group-name">Nombre del grupo</Label>
                  <Input id="group-name" name="name" defaultValue={group.name} required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="group-category">Categoría</Label>
                  <Select value={categorySelect} onValueChange={(v) => setCategorySelect(v ?? NONE)}>
                    <SelectTrigger id="group-category" className="h-11 w-full">
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin categoría</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {categories.length === 0 ? (
                <p className="text-xs text-amber-800/90">
                  No hay categorías cargadas para este torneo. Si eres admin, créalas en la sección «Categorías de
                  grupo» arriba (elige el torneo en los filtros).
                </p>
              ) : null}
              <Button type="submit" className="w-full sm:w-auto">
                Guardar datos del grupo
              </Button>
            </form>

            <div className="space-y-3 rounded-2xl border border-[#E2E8F0] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#102A43]">Jugadores del grupo</h3>
                <span className="text-xs text-[#64748B]">
                  {group.players.length} / {group.max_players}
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
                {group.players.length === 0 ? (
                  <p className="p-4 text-sm text-[#64748B] sm:p-5">Aún no hay jugadores asignados.</p>
                ) : (
                  group.players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3 last:border-b-0 sm:px-4 sm:py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#102A43]">{player.display_name}</p>
                        <p className="truncate text-xs text-[#64748B]">{player.profile?.email ?? 'Sin email'}</p>
                      </div>
                      <Button variant="ghost" size="icon-sm" onClick={() => onRemove(player.id)}>
                        <Trash2 className="size-4" />
                        <span className="sr-only">Remover jugador</span>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <form
            className="mt-6 space-y-4 rounded-2xl bg-[#F8FAFC] p-5 sm:mt-8 sm:p-6"
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label className="text-sm font-medium">Asignar jugador</Label>
              <span className="text-xs text-[#64748B]">
                {group.players.length} / {group.max_players}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Select value={selectedUserId} onValueChange={(value) => setSelectedUserId(value ?? '')} disabled={isFull}>
                <SelectTrigger className="h-11 w-full">
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
                className="h-11"
              />
              <Input
                type="number"
                value={seedOrder}
                onChange={(event) => setSeedOrder(Number(event.target.value))}
                placeholder="Seed"
                disabled={isFull}
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={isFull || !selectedUserId}>
              Asignar jugador
            </Button>
          </form>

          <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:gap-8 sm:mt-8">
            <div className="space-y-4 rounded-2xl border border-[#E2E8F0] p-5 sm:p-6">
              <div>
                <h3 className="text-sm font-semibold text-[#102A43]">Cruces round-robin</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
                  Genera partidos desde el panel admin. «Regenerar» borra cruces previos del grupo.
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
                <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
                  Hora de fin y cancha para habilitar captura de marcador por jugadores.
                </p>
              </div>
              <GroupMatchScheduleList
                groupId={group.id}
                tournamentId={group.tournament_id}
                currentUserId={currentUserId}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
