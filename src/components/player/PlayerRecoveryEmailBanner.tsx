import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { invokeUpdateUserRecoveryEmail } from '@/services/authEdge'
import { useAuthStore } from '@/stores/authStore'
import { Mail } from 'lucide-react'

export function PlayerRecoveryEmailBanner() {
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
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
      await refreshProfile()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800">
            <Mail className="size-4" aria-hidden />
          </span>
          <CardTitle className="text-base text-[#102A43]">Completa tu correo</CardTitle>
        </div>
        <CardDescription className="text-sm text-[#64748B]">
          Agrega tu correo para poder recuperar tu contraseña si la olvidas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-2 sm:gap-4" onSubmit={submit}>
          <div className="space-y-2 sm:col-span-1">
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
          <div className="space-y-2 sm:col-span-1">
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
          <div className="sm:col-span-2">
            <Button type="submit" className="bg-[#1F5A4C] hover:bg-[#1F5A4C]/90" disabled={busy}>
              Guardar correo
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
