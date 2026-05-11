import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Tags } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { createPlayerCategory, listPlayerCategories } from '@/services/playerCategories'

export function AdminCategoriesPage() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const q = useQuery({ queryKey: ['player-categories'], queryFn: listPlayerCategories })

  const mut = useMutation({
    mutationFn: () => createPlayerCategory({ name, description: description || null }),
    onSuccess: async () => {
      toast.success('Categoría creada')
      setName('')
      setDescription('')
      await qc.invalidateQueries({ queryKey: ['player-categories'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Error al crear'),
  })

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Administración"
        title="Categorías de jugador"
        description="Clasificaciones para importación y perfiles (ej. Varonil, Femenil). Los nombres son únicos sin importar mayúsculas."
      />

      <section className="space-y-4">
        <AdminSectionTitle title="Nueva categoría" description="Úsala antes o durante la carga masiva." />
        <Card className="rounded-2xl border border-slate-200/80">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pc-name">Nombre</Label>
              <Input
                id="pc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Varonil"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-desc">Descripción (opcional)</Label>
              <Input
                id="pc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Categoría principal varonil"
                className="h-11"
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="button"
                className="gap-2 bg-[#1F5A4C] hover:bg-[#1F5A4C]/90"
                disabled={!name.trim() || mut.isPending}
                onClick={() => mut.mutate()}
              >
                <Plus className="size-4" />
                Crear categoría
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <AdminSectionTitle title="Listado" description="Categorías disponibles para el Excel de importación." />
        {q.isLoading ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : (q.data?.length ?? 0) === 0 ? (
          <AdminEmptyState
            icon={Tags}
            title="Aún no hay categorías"
            description="Crea la primera o impórtalas al vuelo desde Usuarios → carga masiva."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {q.data?.map((c) => (
              <Card key={c.id} className="rounded-2xl border border-slate-200/80">
                <CardContent className="p-4">
                  <p className="font-semibold text-[#102A43]">{c.name}</p>
                  {c.description ? (
                    <p className="mt-1 text-sm text-slate-600">{c.description}</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">Sin descripción</p>
                  )}
                  <p className="mt-2 text-[11px] text-slate-400">Actualizado {c.updated_at.slice(0, 10)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
