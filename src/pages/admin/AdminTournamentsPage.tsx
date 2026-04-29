import { Eye, Lock, Plus, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/shared/AdminDataTable'
import { AdminConfirmDialog } from '@/components/admin/shared/AdminConfirmDialog'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminStatusBadge } from '@/components/admin/shared/AdminStatusBadge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { tournamentPath } from '@/lib/tournamentUrl'
import { createTournament, listTournaments, updateTournament } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { Tournament } from '@/types/database'

function CreateTournamentModal({
  onCreate,
  disabled,
}: {
  onCreate: (values: { name: string; category: string }) => void
  disabled?: boolean
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')

  return (
    <AdminFormModal
      trigger={
        <Button
          className="w-full sm:w-auto"
          disabled={disabled}
          title={disabled ? 'Cierra el torneo actual antes de crear otro' : undefined}
        >
          <Plus className="size-4" />
          Crear torneo
        </Button>
      }
      title="Crear torneo"
      description={
        disabled
          ? 'Cierra el torneo actual (estado finalizado) antes de crear uno nuevo.'
          : 'Se crea en borrador con reglas por defecto para configurarlo después.'
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onCreate({ name, category })
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="tournament-name">Nombre</Label>
          <Input id="tournament-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tournament-category">Categoría</Label>
          <Input id="tournament-category" value={category} onChange={(event) => setCategory(event.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={disabled}>
          Crear torneo
        </Button>
      </form>
    </AdminFormModal>
  )
}

export function AdminTournamentsPage() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const tournamentsQ = useQuery({ queryKey: ['admin-tournaments'], queryFn: listTournaments })
  const hasOpenTournament = useMemo(
    () => (tournamentsQ.data ?? []).some((t) => t.status !== 'finished'),
    [tournamentsQ.data],
  )

  const createMut = useMutation({
    mutationFn: async (values: { name: string; category: string }) => {
      if (!userId) throw new Error('No autenticado')
      return createTournament({
        name: values.name,
        category: values.category,
        status: 'draft',
        createdBy: userId,
      })
    },
    onSuccess: async () => {
      toast.success('Torneo creado')
      await qc.invalidateQueries({ queryKey: ['admin-tournaments'] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al crear torneo'),
  })

  const closeMut = useMutation({
    mutationFn: async (tournamentId: string) => {
      await updateTournament(tournamentId, { status: 'finished' })
    },
    onSuccess: async () => {
      toast.success('Torneo cerrado')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-tournaments'] }),
        qc.invalidateQueries({ queryKey: ['tournaments'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al cerrar torneo'),
  })

  const columns: AdminDataTableColumn<Tournament>[] = [
    {
      key: 'name',
      header: 'Torneo',
      render: (tournament) => (
        <div>
          <p className="font-medium text-[#102A43]">{tournament.name}</p>
          <p className="text-xs text-[#64748B]">{tournament.category ?? 'Sin categoría'}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Estado', render: (tournament) => <AdminStatusBadge status={tournament.status} /> },
    { key: 'season', header: 'Temporada', render: (tournament) => tournament.season ?? '-' },
    { key: 'created', header: 'Creado', render: (tournament) => tournament.created_at.slice(0, 10) },
    {
      key: 'actions',
      header: 'Acciones',
      render: (tournament) => (
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} to={tournamentPath(tournament)}>
            Gestionar torneo
          </Link>
          <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/dashboard">
            <Eye className="size-3.5" />
            Ver en inicio
          </Link>
          <AdminConfirmDialog
            title="¿Cerrar torneo?"
            description="El torneo pasará a estado finalizado. Los resultados seguirán visibles para consulta."
            confirmLabel="Cerrar torneo"
            disabled={closeMut.isPending || tournament.status === 'finished'}
            onConfirm={() => closeMut.mutate(tournament.id)}
            trigger={
              <Button variant="destructive" size="sm" disabled={tournament.status === 'finished'}>
                <Lock className="size-3.5" />
                Cerrar torneo
              </Button>
            }
          />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Torneos"
        title="Administración de torneos"
        description={
          hasOpenTournament
            ? 'Solo puedes crear un torneo nuevo cuando el actual esté cerrado (estado finalizado).'
            : 'Crea torneos y entra al detalle para configurar reglas, grupos y calendarios.'
        }
        actions={<CreateTournamentModal disabled={hasOpenTournament} onCreate={(values) => createMut.mutate(values)} />}
      />
      {tournamentsQ.isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : (tournamentsQ.data ?? []).length === 0 ? (
        <AdminEmptyState
          title="Aún no hay torneos creados."
          description="Crea el primer torneo para comenzar a organizar grupos y partidos."
          icon={Trophy}
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <AdminDataTable rows={tournamentsQ.data ?? []} columns={columns} getRowKey={(tournament) => tournament.id} />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {(tournamentsQ.data ?? []).map((tournament) => (
              <Card key={tournament.id} className="border-[#E2E8F0] bg-white shadow-sm">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#102A43]">{tournament.name}</p>
                      <p className="mt-0.5 text-xs text-[#64748B]">{tournament.category ?? 'Sin categoría'}</p>
                    </div>
                    <div className="shrink-0">
                      <AdminStatusBadge status={tournament.status} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-[#64748B]">Temporada</p>
                      <p className="font-medium text-[#102A43]">{tournament.season ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B]">Creado</p>
                      <p className="font-medium text-[#102A43]">{tournament.created_at.slice(0, 10)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 border-t border-[#E2E8F0] pt-3 sm:flex-row sm:flex-wrap">
                    <Link
                      className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full justify-center sm:w-auto' })}
                      to={tournamentPath(tournament)}
                    >
                      Gestionar torneo
                    </Link>
                    <Link
                      className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'w-full justify-center sm:w-auto' })}
                      to="/dashboard"
                    >
                      <Eye className="size-3.5" />
                      Ver en inicio
                    </Link>
                    <AdminConfirmDialog
                      title="¿Cerrar torneo?"
                      description="El torneo pasará a estado finalizado. Los resultados seguirán visibles para consulta."
                      confirmLabel="Cerrar torneo"
                      disabled={closeMut.isPending || tournament.status === 'finished'}
                      onConfirm={() => closeMut.mutate(tournament.id)}
                      trigger={
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full sm:w-auto"
                          disabled={tournament.status === 'finished'}
                        >
                          <Lock className="size-3.5" />
                          Cerrar torneo
                        </Button>
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
