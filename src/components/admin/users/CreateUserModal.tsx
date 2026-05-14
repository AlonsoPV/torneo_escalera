import { useState } from 'react'

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
import { ADMIN_USER_ASSIGNABLE_ROLES, userRoleLabelEs } from '@/lib/permissions'
import type { Group, PlayerCategory, UserRole } from '@/types/database'

export function CreateUserModal({
  groups,
  categories,
  onSubmit,
}: {
  groups: Group[]
  categories: PlayerCategory[]
  onSubmit: (values: {
    fullName: string
    phone: string
    temporaryPassword: string
    role: UserRole
    categoryId: string
    groupId?: string
    tournamentId?: string | null
  }) => void
}) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [role, setRole] = useState<UserRole>('player')
  const [categoryId, setCategoryId] = useState(() => categories[0]?.id ?? '')
  const [groupId, setGroupId] = useState('none')

  return (
    <AdminFormModal
      trigger={<Button className="w-full sm:w-auto">Agregar usuario</Button>}
      title="Crear usuario"
      description="El alta usa una Edge Function segura: correo técnico interno y celular como identificador."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          const gid = groupId === 'none' ? undefined : groupId
          const selectedGroup = gid ? groups.find((g) => g.id === gid) : undefined
          onSubmit({
            fullName,
            phone,
            temporaryPassword,
            role,
            categoryId,
            groupId: gid,
            tournamentId: selectedGroup?.tournament_id ?? null,
          })
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="create-full-name">Nombre completo</Label>
          <Input id="create-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-phone">Número de celular</Label>
          <Input
            id="create-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Ej. 5512345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-password">Contraseña temporal</Label>
          <Input
            id="create-password"
            type="password"
            value={temporaryPassword}
            onChange={(e) => setTemporaryPassword(e.target.value)}
            required
          />
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
                <SelectValue placeholder="Elige categoría" />
              </SelectTrigger>
              <SelectContent>
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
          <Label>Grupo opcional</Label>
          <Select value={groupId} onValueChange={(value) => setGroupId(value ?? 'none')}>
            <SelectTrigger className="min-w-[180px] w-full">
              <SelectValue placeholder="Sin grupo (opcional)" />
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
        <Button type="submit" className="w-full" disabled={!categoryId}>
          Crear usuario
        </Button>
      </form>
    </AdminFormModal>
  )
}
