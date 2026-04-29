import { Pencil } from 'lucide-react'
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
import type { AdminUserRecord } from '@/services/admin'
import type { Group, UserRole } from '@/types/database'

export function EditUserModal({
  user,
  groups,
  onSubmit,
}: {
  user: AdminUserRecord
  groups: Group[]
  onSubmit: (values: { fullName: string; email: string; role: UserRole; groupId?: string }) => void
}) {
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [email, setEmail] = useState(user.email ?? '')
  const [role, setRole] = useState<UserRole>(user.role)
  const [groupId, setGroupId] = useState(user.group?.id ?? 'none')

  return (
    <AdminFormModal
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="size-3.5" />
          Editar
        </Button>
      }
      title="Editar usuario"
      description="Actualiza datos visibles del perfil y prepara la asignación de grupo."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit({ fullName, email, role, groupId: groupId === 'none' ? undefined : groupId })
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={`edit-name-${user.id}`}>Nombre completo</Label>
          <Input id={`edit-name-${user.id}`} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`edit-email-${user.id}`}>Email</Label>
          <Input id={`edit-email-${user.id}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="player">Jugador</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super admin</SelectItem>
                <SelectItem value="captain">Capitán</SelectItem>
                <SelectItem value="referee">Árbitro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Grupo</Label>
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
          Guardar cambios
        </Button>
      </form>
    </AdminFormModal>
  )
}
