import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { invokeUpdateUserRecoveryEmail } from '@/services/authEdge'
import { useAuthStore } from '@/stores/authStore'
import { Mail } from 'lucide-react'

export function PlayerRecoveryEmailBanner() {
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const a = email.trim().toLowerCase()
    const b = confirm.trim().toLowerCase()
    if (!a || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) {
      toast.error('Introduce un correo válido.')
      return
    }
    if (a !== b) {
      toast.error('Los correos no coinciden.')
      return
    }
    setBusy(true)
    try {
      await invokeUpdateUserRecoveryEmail(a)
      toast.success('Correo guardado')
      setEmail('')
      setConfirm('')
      setOpen(false)
      await refreshProfile()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 shadow-sm sm:gap-3 sm:px-4 sm:py-2.5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-900">
            <Mail className="size-3.5" aria-hidden />
          </span>
          <p className="min-w-0 leading-snug">
            Agrega tu correo para recuperar tu contraseña.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-amber-300/80 bg-white text-amber-950 hover:bg-amber-100/80"
          onClick={() => setOpen(true)}
        >
          Agregar correo
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Correo de recuperación</DialogTitle>
            <DialogDescription>
              Lo usaremos solo para que puedas restablecer tu contraseña si la olvidas.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Correo</Label>
              <Input
                id="recovery-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recovery-email-confirm">Confirmar correo</Label>
              <Input
                id="recovery-email-confirm"
                type="email"
                autoComplete="email"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#1F5A4C] hover:bg-[#1F5A4C]/90" disabled={busy}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
