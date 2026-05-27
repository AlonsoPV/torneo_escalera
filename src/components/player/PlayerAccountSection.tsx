import { useMemo, useState } from 'react'
import { Loader2, Lock, Save, UserCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatRecoveryEmailDisplay, recoveryEmailComplete } from '@/lib/profileEmail'
import { normalizePhone } from '@/lib/phone'
import { invokeUpdateUserAccount } from '@/services/authEdge'
import { isPasswordLongEnough, passwordMinLengthError } from '@/lib/passwordPolicy'
import { useAuthStore } from '@/stores/authStore'
import type { Profile } from '@/types/database'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function PlayerAccountSection({ profile }: { profile: Profile }) {
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [email, setEmail] = useState(profile.email ?? '')
  const [confirmEmail, setConfirmEmail] = useState(profile.email ?? '')
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [busyProfile, setBusyProfile] = useState(false)
  const [busyPwd, setBusyPwd] = useState(false)

  const recovery = formatRecoveryEmailDisplay(profile.email)
  const complete = recoveryEmailComplete(profile)

  const profileChanged = useMemo(() => {
    return (
      fullName.trim() !== (profile.full_name ?? '').trim() ||
      phone.trim() !== (profile.phone ?? '').trim() ||
      email.trim().toLowerCase() !== (profile.email ?? '').trim().toLowerCase()
    )
  }, [email, fullName, phone, profile.email, profile.full_name, profile.phone])

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextName = fullName.trim()
    const nextConfirm = confirmEmail.trim().toLowerCase()
    const nextEmail = email.trim().toLowerCase()
    const parsedPhone = normalizePhone(phone)

    if (nextName.length < 2) {
      toast.error('Escribe tu nombre completo.')
      return
    }
    if (!parsedPhone.ok) {
      toast.error(parsedPhone.error)
      return
    }
    if (nextEmail && !EMAIL_RE.test(nextEmail)) {
      toast.error('Introduce un correo de recuperacion valido.')
      return
    }
    if (nextEmail !== nextConfirm) {
      toast.error('Los correos de recuperacion no coinciden.')
      return
    }

    setBusyProfile(true)
    try {
      await invokeUpdateUserAccount({
        fullName: nextName,
        phone: parsedPhone.digits,
        recoveryEmail: nextEmail || null,
      })
      toast.success('Datos actualizados')
      setPhone(parsedPhone.digits)
      setEmail(nextEmail)
      setConfirmEmail(nextEmail)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron guardar tus datos')
    } finally {
      setBusyProfile(false)
    }
    void refreshProfile()
  }

  const savePwd = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isPasswordLongEnough(pwd)) {
      toast.error(passwordMinLengthError('La contrasena'))
      return
    }
    if (pwd !== pwd2) {
      toast.error('Las contrasenas no coinciden.')
      return
    }
    setBusyPwd(true)
    try {
      await invokeUpdateUserAccount({ newPassword: pwd })
      toast.success('Contrasena actualizada')
      setPwd('')
      setPwd2('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar la contrasena')
    } finally {
      setBusyPwd(false)
    }
    void refreshProfile()
  }

  return (
    <div className="space-y-4">
      <Card className="border-[#E2E8F0] shadow-sm">
        <CardHeader className="space-y-1 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#1F5A4C]/10 text-[#1F5A4C]">
              <UserCircle className="size-5" aria-hidden />
            </span>
            <CardTitle className="text-base text-[#102A43]">Mis datos</CardTitle>
          </div>
          <CardDescription className="text-sm text-[#64748B]">
            Actualiza tu nombre, celular y correo de recuperacion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-[#F1F5F9] pb-2">
              <dt className="text-[#64748B]">Correo actual</dt>
              <dd className="max-w-[14rem] truncate text-right font-medium text-[#102A43]">{recovery}</dd>
            </div>
            <div className="flex justify-between gap-4 pb-1">
              <dt className="text-[#64748B]">Estado</dt>
              <dd className="text-right font-medium text-[#102A43]">{complete ? 'Completo' : 'Pendiente'}</dd>
            </div>
          </dl>

          <form className="grid gap-4" onSubmit={saveProfile}>
            <div className="space-y-2">
              <Label htmlFor="acct-name">Nombre</Label>
              <Input
                id="acct-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={busyProfile}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="acct-phone">Celular</Label>
              <Input
                id="acct-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={busyProfile}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="acct-email">Correo de recuperacion</Label>
                <Input
                  id="acct-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  disabled={busyProfile}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acct-email2">Confirmar correo</Label>
                <Input
                  id="acct-email2"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  disabled={busyProfile}
                />
              </div>
            </div>

            <Button type="submit" className="w-full gap-2 sm:w-fit" disabled={busyProfile || !profileChanged}>
              {busyProfile ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
              Guardar datos
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-[#E2E8F0] shadow-sm">
        <CardHeader className="space-y-1 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#1F5A4C]/10 text-[#1F5A4C]">
              <Lock className="size-5" aria-hidden />
            </span>
            <CardTitle className="text-base text-[#102A43]">Contrasena</CardTitle>
          </div>
          <CardDescription className="text-sm text-[#64748B]">
            Cambia tu contrasena de acceso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={savePwd}>
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
              <Label htmlFor="acct-pwd">Nueva contrasena</Label>
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
              <Button type="submit" variant="outline" className="w-full gap-2 sm:w-fit" disabled={busyPwd}>
                {busyPwd ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
                Actualizar contrasena
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
