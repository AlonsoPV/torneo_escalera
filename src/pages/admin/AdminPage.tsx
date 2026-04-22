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
import { adminSetUserRole, listProfilesForAdmin } from '@/services/profiles'
import { createTournament, listTournaments } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { UserRole } from '@/types/database'

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().optional(),
})

type CreateForm = z.infer<typeof createSchema>

export function AdminPage() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)

  const tq = useQuery({ queryKey: ['tournaments'], queryFn: listTournaments })
  const pq = useQuery({ queryKey: ['profiles-admin'], queryFn: listProfilesForAdmin })

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', description: '', category: '' },
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
      })
    },
    onSuccess: async (t) => {
      toast.success('Torneo creado')
      form.reset({ name: '', description: '', category: '' })
      await qc.invalidateQueries({ queryKey: ['tournaments'] })
      window.location.href = `/tournaments/${t.id}`
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
            update profiles set role = &apos;admin&apos; where email = &apos;...&apos;;
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
            <Button type="submit" disabled={createMut.isPending}>
              Crear torneo
            </Button>
          </form>
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
                  <Link className="text-primary underline-offset-4 hover:underline" to={`/tournaments/${t.id}`}>
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
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="player">player</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
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
