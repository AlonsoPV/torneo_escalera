import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { userRoleLabelEs } from '@/lib/permissions'
import { tournamentPath } from '@/lib/tournamentUrl'
import { getAdminDashboardStats } from '@/services/dashboardAdmin'
import { adminSetUserRole, listProfilesForAdmin } from '@/services/profiles'
import { createTournament, listTournaments } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { UserRole } from '@/types/database'

const ADMIN_PAGE_ROLE_OPTIONS = [
  'player',
  'admin',
  'super_admin',
  'captain',
  'referee',
] as const satisfies readonly UserRole[]

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().optional(),
  initialGroups: z.enum(['none', 'per_category']),
})

type CreateForm = z.infer<typeof createSchema>

export function AdminPage() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)

  const tq = useQuery({ queryKey: ['tournaments'], queryFn: listTournaments })
  const pq = useQuery({ queryKey: ['profiles-admin'], queryFn: listProfilesForAdmin })
  const statsQ = useQuery({
    queryKey: ['adminStats'],
    queryFn: getAdminDashboardStats,
  })

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', description: '', category: '', initialGroups: 'none' },
  })

  const createMut = useMutation({
    mutationFn: async (values: CreateForm) => {
      if (!userId) throw new Error('No autenticado')
      return createTournament({
        name: values.name,
        description: values.description,
        category: values.category,
        status: 'draft',
        createdBy: userId,
        initialGroups: values.initialGroups,
      })
    },
    onSuccess: async (result) => {
      const msg =
        result.groupsCreated > 0
          ? `Torneo creado con ${result.groupsCreated} grupo(s)`
          : 'Torneo creado'
      toast.success(msg)
      form.reset({ name: '', description: '', category: '', initialGroups: 'none' })
      await qc.invalidateQueries({ queryKey: ['tournaments'] })
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-groups'] }),
        qc.invalidateQueries({ queryKey: ['group-categories'] }),
        qc.invalidateQueries({ queryKey: ['admin-tournaments'] }),
      ])
      window.location.href = tournamentPath(result.tournament)
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Error al crear torneo')
    },
  })

  const submit = form.handleSubmit((v) => createMut.mutate(v))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
        <p className="text-sm text-muted-foreground">
          Crear torneos y gestionar roles. Los admins se pueden promover manualmente en SQL
          si lo prefieres:{' '}
          <code className="rounded bg-muted px-1 text-xs">
            update profiles set role = &apos;admin&apos; or &apos;super_admin&apos; where email = &apos;...&apos;;
          </code>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo torneo</CardTitle>
          <CardDescription>Se crea en estado borrador con reglas por defecto.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submit}>
            <div>
              <Label>Nombre</Label>
              <Input {...form.register('name')} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input {...form.register('description')} />
            </div>
            <div>
              <Label>Categoría</Label>
              <Input {...form.register('category')} />
            </div>
            <div>
              <Label htmlFor="admin-home-initial-groups">Grupos iniciales</Label>
              <select
                id="admin-home-initial-groups"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...form.register('initialGroups')}
              >
                <option value="none">Sin grupos (administrar después en Grupos)</option>
                <option value="per_category">Un grupo vacío por división (registros reales en grupos)</option>
              </select>
            </div>
            <Button type="submit" disabled={createMut.isPending}>
              Crear torneo
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen operativo</CardTitle>
          <CardDescription>Contadores globales (MVP) para cruces y seguimiento de resultados.</CardDescription>
        </CardHeader>
        <CardContent>
          {statsQ.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : statsQ.data ? (
            <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <li>
                <span className="text-muted-foreground">Torneos / activos: </span>
                {statsQ.data.tournamentCount} / {statsQ.data.activeTournamentCount}
              </li>
              <li>
                <span className="text-muted-foreground">Grupos: </span>
                {statsQ.data.groupCount}
              </li>
              <li>
                <span className="text-muted-foreground">Partidos totales: </span>
                {statsQ.data.matchCount}
              </li>
              <li>
                <span className="text-muted-foreground">Pendientes de marcador: </span>
                {statsQ.data.pendingScoreCount}
              </li>
              <li>
                <span className="text-muted-foreground">Pend. confirmar (enviado por jugador): </span>
                {statsQ.data.resultSubmittedCount}
              </li>
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No se pudieron cargar métricas.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Torneos</CardTitle>
          <CardDescription>Accesos rápidos al detalle.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tq.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <ul className="space-y-1 text-sm">
              {(tq.data ?? []).map((t) => (
                <li key={t.id}>
                  <Link className="text-primary underline-offset-4 hover:underline" to={tournamentPath(t)}>
                    {t.name}
                  </Link>{' '}
                  <span className="text-xs text-muted-foreground">({t.status})</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roles de usuario</CardTitle>
          <CardDescription>
            Solo para operadores admin. Cambiar rol afecta acceso inmediato tras recargar perfil.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pq.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <ul className="space-y-3 text-sm">
              {(pq.data ?? []).map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{p.full_name ?? p.email}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={p.role}
                      onValueChange={async (role) => {
                        try {
                          await adminSetUserRole(p.id, role as UserRole)
                          toast.success('Rol actualizado')
                          await qc.invalidateQueries({ queryKey: ['profiles-admin'] })
                          await qc.invalidateQueries({ queryKey: ['tournament'] })
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Error')
                        }
                      }}
                    >
                      <SelectTrigger className="w-36 min-w-0">
                        <SelectValue>{userRoleLabelEs(p.role)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ADMIN_PAGE_ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {userRoleLabelEs(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
