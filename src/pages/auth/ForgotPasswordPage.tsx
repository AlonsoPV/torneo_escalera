import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2, Trophy } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getPasswordResetRedirectUrl } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { isSupabaseConfigured } from '@/lib/supabase'
import { invokePasswordResetRequest, PasswordResetRequestError } from '@/services/authEdge'
import { useAuthStore } from '@/stores/authStore'
import { AuthPageShell } from '@/pages/auth/AuthPageShell'

const schema = z.object({
  recoveryEmail: z
    .string()
    .min(1, 'Introduce el correo de recuperación')
    .email('Introduce un correo electrónico válido'),
})

type Form = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.initialized)
  const [sent, setSent] = useState(false)

  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { recoveryEmail: '' } })

  if (initialized && session) {
    return <Navigate to="/" replace />
  }

  if (!isSupabaseConfigured) {
    return (
      <AuthPageShell>
        <div className="mx-auto flex min-h-dvh max-w-6xl items-center justify-center p-6">
          <Card className="w-full max-w-md border-border/60 shadow-lg shadow-black/5">
            <CardHeader>
              <CardTitle className="text-lg">Configuración pendiente</CardTitle>
              <CardDescription>Conecta Supabase para usar la recuperación de contraseña.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/login" className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex w-full')}>
                Volver al inicio de sesión
              </Link>
            </CardContent>
          </Card>
        </div>
      </AuthPageShell>
    )
  }

  const submit = form.handleSubmit(async (values) => {
    try {
      await invokePasswordResetRequest(values.recoveryEmail.trim(), getPasswordResetRedirectUrl())
      setSent(true)
      toast.success(
        'Si ese correo está registrado como recuperación en tu cuenta, revisa tu bandeja (incluido spam) para el enlace.',
      )
    } catch (e) {
      if (e instanceof PasswordResetRequestError && e.code === 'no_recovery_email') {
        toast.error('Aún no tienes correo registrado. Contacta al administrador.')
        return
      }
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('Aún no tienes un correo registrado')) {
        toast.error('Aún no tienes correo registrado. Contacta al administrador.')
        return
      }
      toast.error(msg || 'No se pudo procesar la solicitud')
    }
  })

  return (
    <AuthPageShell>
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md border-border/60 shadow-lg shadow-black/5">
          <CardHeader className="space-y-1">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <Trophy className="size-5" aria-hidden />
              </div>
              <CardTitle className="text-xl font-semibold tracking-tight">Recuperar contraseña</CardTitle>
            </div>
            <CardDescription className="text-base leading-relaxed">
              {sent ? (
                <>
                  Si este correo coincide con el <strong className="font-medium text-foreground">correo de recuperación</strong>{' '}
                  guardado en tu cuenta, te enviaremos un enlace para elegir una nueva contraseña.
                </>
              ) : (
                <>
                  Solo usa el <strong className="font-medium text-foreground">correo de recuperación</strong> que registraste en
                  la app (no el celular). Si ya está registrado, recibirás el enlace; si aún no tienes correo en tu cuenta,{' '}
                  <strong className="font-medium text-foreground">contacta a un administrador</strong>.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <div className="space-y-4">
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                  <p>
                    Si tu cuenta tiene ese correo de recuperación, el mensaje puede tardar unos minutos. Revisa también{' '}
                    <span className="font-medium text-foreground">spam o promociones</span>. El enlace caduca por seguridad.
                  </p>
                  <p>
                    Si <span className="font-medium text-foreground">no registraste un correo</span> en tu perfil, no llegará
                    ningún enlace: escribe al administrador del torneo para que te ayude.
                  </p>
                </div>
                <Link
                  to="/login"
                  className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex w-full items-center justify-center gap-2')}
                >
                  <ArrowLeft className="size-4 shrink-0" aria-hidden />
                  Volver al inicio de sesión
                </Link>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={submit} noValidate>
                <div className="rounded-lg border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-xs leading-snug text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                  El enlace solo se envía si este correo es exactamente el que guardaste como recuperación. Sin correo
                  registrado, debes pedir ayuda a un administrador.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forgot-recovery-email">Correo de recuperación</Label>
                  <Input
                    id="forgot-recovery-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="tu@correo.com"
                    className={cn(
                      'h-10',
                      form.formState.errors.recoveryEmail && 'border-destructive aria-invalid:border-destructive',
                    )}
                    aria-invalid={!!form.formState.errors.recoveryEmail}
                    {...form.register('recoveryEmail')}
                  />
                  {form.formState.errors.recoveryEmail ? (
                    <p className="text-xs text-destructive" role="alert">
                      {form.formState.errors.recoveryEmail.message}
                    </p>
                  ) : null}
                </div>
                <Button className="h-10 w-full gap-2 text-base font-medium" type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Enviando…
                    </>
                  ) : (
                    'Enviar enlace'
                  )}
                </Button>
                <Link
                  to="/login"
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    'inline-flex h-10 w-full items-center justify-center gap-2 text-muted-foreground',
                  )}
                >
                  <ArrowLeft className="size-4 shrink-0" aria-hidden />
                  Volver al inicio de sesión
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthPageShell>
  )
}
