import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updatePassword } from '@/lib/auth'
import { formatRecoveryEmailDisplay, recoveryEmailComplete } from '@/lib/profileEmail'
import { invokeUpdateUserRecoveryEmail } from '@/services/authEdge'
import type { Profile } from '@/types/database'
import { useAuthStore } from '@/stores/authStore'
import { UserCircle } from 'lucide-react'

export function PlayerAccountSection({ profile }: { profile: Profile }) {
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const [email, setEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [busyEmail, setBusyEmail] = useState(false)
  const [busyPwd, setBusyPwd] = useState(false)

  const recovery = formatRecoveryEmailDisplay(profile.email)
  const complete = recoveryEmailComplete(profile)

  const saveEmail = async (event: React.FormEvent) => {
    event.preventDefault()
    const a = email.trim().toLowerCase()
    const b = confirmEmail.trim().toLowerCase()
    if (!a || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) {
      toast.error('Introduce un correo válido.')
      return
    }
    if (a !== b) {
      toast.error('Los correos no coinciden.')
      return
    }
    setBusyEmail(true)
    try {
      await invokeUpdateUserRecoveryEmail(a)
      toast.success('Correo actualizado')
      setEmail('')
      setConfirmEmail('')
      await refreshProfile()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el correo')
    } finally {
      setBusyEmail(false)
    }
  }

  const savePwd = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pwd.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (pwd !== pwd2) {
      toast.error('Las contraseñas no coinciden.')
      return
    }
    setBusyPwd(true)
    try {
      await updatePassword(pwd)
      toast.success('Contraseña actualizada')
      setPwd('')
      setPwd2('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña')
    } finally {
      setBusyPwd(false)
    }
  }

  return (
    <Card className="border-[#E2E8F0] shadow-sm">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#1F5A4C]/10 text-[#1F5A4C]">
            <UserCircle className="size-5" aria-hidden />
          </span>
          <CardTitle className="text-base text-[#102A43]">Datos de cuenta</CardTitle>
        </div>
        <CardDescription className="text-sm text-[#64748B]">
          Nombre, celular y correo de recuperación (no mostramos datos técnicos de acceso).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-[#F1F5F9] pb-2">
            <dt className="text-[#64748B]">Nombre</dt>
            <dd className="text-right font-medium text-[#102A43]">{profile.full_name ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[#F1F5F9] pb-2">
            <dt className="text-[#64748B]">Celular</dt>
            <dd className="text-right font-medium text-[#102A43]">{profile.phone ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[#F1F5F9] pb-2">
            <dt className="text-[#64748B]">Correo de recuperación</dt>
            <dd className="text-right font-medium text-[#102A43]">{recovery}</dd>
          </div>
          <div className="flex justify-between gap-4 pb-1">
            <dt className="text-[#64748B]">Estado</dt>
            <dd className="text-right font-medium text-[#102A43]">{complete ? 'Completo' : 'Pendiente'}</dd>
          </div>
        </dl>

        <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
            {complete ? 'Cambiar correo de recuperación' : 'Agregar correo de recuperación'}
          </p>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveEmail}>
            <div className="space-y-2">
              <Label htmlFor="acct-email">Correo</Label>
              <Input
                id="acct-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={complete ? 'nuevo@correo.com' : 'tu@correo.com'}
                disabled={busyEmail}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acct-email2">Confirmar correo</Label>
              <Input
                id="acct-email2"
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                disabled={busyEmail}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary" disabled={busyEmail}>
                Guardar correo
              </Button>
            </div>
          </form>
        </div>

        <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Cambiar contraseña</p>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={savePwd}>
            {/* Ayuda a gestores de contraseñas y cumple la recomendación del navegador (username + password en el mismo form). */}
            <div className="sr-only sm:col-span-2">
              <Label htmlFor="acct-pwd-username">Identificador de cuenta</Label>
              <Input
                id="acct-pwd-username"
                type="text"
                autoComplete="username"
                readOnly
                tabIndex={-1}
                value={profile.phone ?? profile.email ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acct-pwd">Nueva contraseña</Label>
              <Input
                id="acct-pwd"
                type="password"
                autoComplete="new-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                disabled={busyPwd}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acct-pwd2">Confirmar</Label>
              <Input
                id="acct-pwd2"
                type="password"
                autoComplete="new-password"
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                disabled={busyPwd}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="outline" disabled={busyPwd}>
                Actualizar contraseña
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
