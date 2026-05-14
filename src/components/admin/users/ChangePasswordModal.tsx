import { KeyRound } from 'lucide-react'
import { useState, type MouseEventHandler, type ReactElement } from 'react'
import { toast } from 'sonner'

import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TriggerProps = ReactElement<{
  onClick?: MouseEventHandler<HTMLElement>
}>

export function ChangePasswordModal({
  userId,
  onSubmit,
  trigger,
  open,
  onOpenChange,
}: {
  userId: string
  onSubmit: (values: { userId: string; newPassword: string }) => void
  trigger?: TriggerProps | false
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <KeyRound className="size-3.5" />
      Cambiar contraseña
    </Button>
  )

  return (
    <AdminFormModal
      trigger={trigger === false ? undefined : trigger ?? defaultTrigger}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setPassword('')
          setConfirmPassword('')
        }
        onOpenChange?.(nextOpen)
      }}
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
