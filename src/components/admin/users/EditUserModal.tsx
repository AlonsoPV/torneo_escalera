import { Pencil } from 'lucide-react'
import { useEffect, useState, type MouseEventHandler, type ReactElement } from 'react'

import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
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
import { ADMIN_USER_ASSIGNABLE_ROLES, normalizeAdminAssignableRole, userRoleLabelEs } from '@/lib/permissions'
import { formatRecoveryEmailDisplay } from '@/lib/profileEmail'
import type { AdminUserRecord } from '@/services/admin'
import type { Group, PlayerCategory, UserRole } from '@/types/database'

type TriggerProps = ReactElement<{
  onClick?: MouseEventHandler<HTMLElement>
}>

export function EditUserModal({
  user,
  groups,
  categories,
  onSubmit,
  trigger,
  open,
  onOpenChange,
}: {
  user: AdminUserRecord
  groups: Group[]
  categories: PlayerCategory[]
  onSubmit: (values: {
    fullName: string
    role: UserRole
    categoryId: string
    groupId?: string
  }) => void
  /** Omite el botón disparador (p. ej. barra de acciones global con `open`). */
  trigger?: TriggerProps | false
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [role, setRole] = useState<UserRole>(normalizeAdminAssignableRole(user.role))
  const [categoryId, setCategoryId] = useState(user.category_id ?? 'none')
  const [groupId, setGroupId] = useState(user.group?.id ?? 'none')

  useEffect(() => {
    setFullName(user.full_name ?? '')
    setRole(normalizeAdminAssignableRole(user.role))
    setCategoryId(user.category_id ?? 'none')
    setGroupId(user.group?.id ?? 'none')
  }, [user])

  const recoveryLabel = formatRecoveryEmailDisplay(user.email)

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Pencil className="size-3.5" />
      Editar
    </Button>
  )

  return (
    <AdminFormModal
      trigger={trigger === false ? undefined : trigger ?? defaultTrigger}
      open={open}
      onOpenChange={onOpenChange}
      title="Editar usuario"
      description="Actualiza datos del perfil y grupo. El correo de recuperación lo gestiona cada jugador en su panel."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit({
            fullName,
            role,
            categoryId: categoryId === 'none' ? '' : categoryId,
            groupId: groupId === 'none' ? undefined : groupId,
          })
        }}
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium text-slate-700">Correo de recuperación: </span>
          {recoveryLabel}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`edit-phone-${user.id}`}>Celular</Label>
          <Input id={`edit-phone-${user.id}`} value={user.phone ?? '—'} readOnly disabled className="bg-muted" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`edit-name-${user.id}`}>Nombre completo</Label>
          <Input id={`edit-name-${user.id}`} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger className="min-w-[180px] w-full">
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_USER_ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r} label={userRoleLabelEs(r)}>
                    {userRoleLabelEs(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? 'none')}>
              <SelectTrigger className="min-w-[180px] w-full">
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
        </div>
        <div className="space-y-2">
          <Label>Grupo</Label>
          <Select value={groupId} onValueChange={(value) => setGroupId(value ?? 'none')}>
            <SelectTrigger className="min-w-[180px] w-full">
              <SelectValue placeholder="Sin grupo o elige uno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" label="Sin grupo">
                Sin grupo
              </SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id} label={group.name}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full">
          Guardar cambios
        </Button>
      </form>
    </AdminFormModal>
  )
}
