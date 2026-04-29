import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ChangePasswordModal({
  userId,
  onSubmit,
}: {
  userId: string
  onSubmit: (values: { userId: string; newPassword: string }) => void
}) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  return (
    <AdminFormModal
      trigger={
        <Button variant="outline" size="sm">
          <KeyRound className="size-3.5" />
          Cambiar contraseña
        </Button>
      }
      title="Cambiar contraseña"
      description="No se muestran contraseñas actuales. Solo se podrá crear una nueva contraseña temporal."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (password !== confirmPassword) {
            toast.error('Las contraseñas no coinciden')
            return
          }
          onSubmit({ userId, newPassword: password })
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={`new-password-${userId}`}>Nueva contraseña</Label>
          <Input
            id={`new-password-${userId}`}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`confirm-password-${userId}`}>Confirmar contraseña</Label>
          <Input
            id={`confirm-password-${userId}`}
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full">
          Crear contraseña temporal
        </Button>
      </form>
    </AdminFormModal>
  )
}
