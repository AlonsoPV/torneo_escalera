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
import type { Group, UserRole } from '@/types/database'

export function CreateUserModal({
  groups,
  onSubmit,
}: {
  groups: Group[]
  onSubmit: (values: {
    fullName: string
    email: string
    temporaryPassword: string
    role: UserRole
    groupId?: string
  }) => void
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [role, setRole] = useState<UserRole>('player')
  const [groupId, setGroupId] = useState('none')

  return (
    <AdminFormModal
      trigger={<Button className="w-full sm:w-auto">Agregar usuario</Button>}
      title="Crear usuario"
      description="La creación real se conectará a una Edge Function segura con permisos de servidor."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit({
            fullName,
            email,
            temporaryPassword,
            role,
            groupId: groupId === 'none' ? undefined : groupId,
          })
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="create-full-name">Nombre completo</Label>
          <Input id="create-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-email">Email</Label>
          <Input id="create-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_USER_ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {userRoleLabelEs(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Grupo opcional</Label>
            <Select value={groupId} onValueChange={(value) => setGroupId(value ?? 'none')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin grupo</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="submit" className="w-full">
          Crear usuario
        </Button>
      </form>
    </AdminFormModal>
  )
}
