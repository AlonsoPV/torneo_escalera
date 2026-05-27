import { Pencil } from 'lucide-react'
import { useEffect, useMemo, useState, type MouseEventHandler, type ReactElement } from 'react'

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
import type { AdminGroupRecord, AdminUserRecord } from '@/services/admin'
import type { PlayerCategory, UserRole } from '@/types/database'

type TriggerProps = ReactElement<{
  onClick?: MouseEventHandler<HTMLElement>
}>

function distinctGroupsByName(groups: AdminGroupRecord[], currentGroupId: string | undefined): AdminGroupRecord[] {
  const byName = new Map<string, AdminGroupRecord>()
  for (const g of groups) {
    const key = g.name.trim().toLowerCase()
    if (!byName.has(key)) byName.set(key, g)
  }
  const list = [...byName.values()]
  if (currentGroupId && !list.some((g) => g.id === currentGroupId)) {
    const full = groups.find((g) => g.id === currentGroupId)
    if (full) list.unshift(full)
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
}

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
  groups: AdminGroupRecord[]
  categories: PlayerCategory[]
  onSubmit: (values: {
    phone: string
    recoveryEmail: string | null
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
  const [phone, setPhone] = useState(user.phone ?? '')
  const [recoveryEmail, setRecoveryEmail] = useState(user.email?.trim() ?? '')
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [role, setRole] = useState<UserRole>(normalizeAdminAssignableRole(user.role))
  const [categoryId, setCategoryId] = useState(user.category_id ?? 'none')
  const [groupId, setGroupId] = useState(user.group?.id ?? 'none')

  useEffect(() => {
    /* Sincronizar formulario al cambiar de usuario seleccionado. */
    /* eslint-disable react-hooks/set-state-in-effect */
    setPhone(user.phone ?? '')
    setRecoveryEmail(user.email?.trim() ?? '')
    setFullName(user.full_name ?? '')
    setRole(normalizeAdminAssignableRole(user.role))
    setCategoryId(user.category_id ?? 'none')
    setGroupId(user.group?.id ?? 'none')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user])

  const groupOptions = useMemo(
    () => distinctGroupsByName(groups, user.group?.id ?? undefined),
    [groups, user.group?.id],
  )

  const categoryTriggerLabel =
    categoryId === 'none' || !categoryId
      ? 'Sin categoría'
      : (categories.find((c) => c.id === categoryId)?.name ?? 'Categoría desconocida')

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
      description="Teléfono, correo de recuperación y datos del perfil. El número actualiza también el correo técnico de acceso (@mega-varonil.local)."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          const rec = recoveryEmail.trim()
          onSubmit({
            phone: phone.trim(),
            recoveryEmail: rec === '' ? null : rec.toLowerCase(),
            fullName,
            role,
            categoryId: categoryId === 'none' ? '' : categoryId,
            groupId: groupId === 'none' ? undefined : groupId,
          })
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={`edit-phone-${user.id}`}>Celular (cuenta)</Label>
          <Input
            id={`edit-phone-${user.id}`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ej. 5512345678"
            inputMode="tel"
            autoComplete="tel"
          />
          <p className="text-xs text-muted-foreground">Solo dígitos recomendados; se normaliza al guardar.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`edit-recovery-${user.id}`}>Correo de recuperación</Label>
          <Input
            id={`edit-recovery-${user.id}`}
            type="email"
            value={recoveryEmail}
            onChange={(e) => setRecoveryEmail(e.target.value)}
            placeholder="usuario@ejemplo.com"
            autoComplete="email"
          />
          <p className="text-xs text-muted-foreground">
            Déjalo vacío si debe completarlo el jugador. No sustituye el correo técnico de Auth.
          </p>
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
                <SelectValue placeholder="Selecciona un rol">{userRoleLabelEs(role)}</SelectValue>
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
                <SelectValue placeholder="Sin categoría">{categoryTriggerLabel}</SelectValue>
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
              <SelectValue placeholder="Sin grupo o elige uno">
                {groupId === 'none'
                  ? 'Sin grupo'
                  : (groups.find((g) => g.id === groupId)?.name ?? groupOptions.find((g) => g.id === groupId)?.name ?? '')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" label="Sin grupo">
                Sin grupo
              </SelectItem>
              {groupOptions.map((group) => (
                <SelectItem key={group.id} value={group.id} label={group.name}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Si hay varios torneos con el mismo nombre de grupo, solo se muestra una fila por nombre.
          </p>
        </div>
        <Button type="submit" className="w-full">
          Guardar cambios
        </Button>
      </form>
    </AdminFormModal>
  )
}
