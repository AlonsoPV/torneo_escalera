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
import { invokePasswordResetRequest } from '@/services/authEdge'
import { useAuthStore } from '@/stores/authStore'
import { AuthPageShell } from '@/pages/auth/AuthPageShell'

const schema = z.object({
  identifier: z.string().min(1, 'Introduce tu celular o correo'),
})

type Form = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.initialized)
  const [sent, setSent] = useState(false)

  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { identifier: '' } })

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
      await invokePasswordResetRequest(values.identifier.trim(), getPasswordResetRedirectUrl())
      setSent(true)
      toast.success('Si existe una cuenta con ese dato, revisa tu correo.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo procesar la solicitud')
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
              {sent
                ? 'Si existe una cuenta con ese número o correo, recibirás un enlace para elegir una nueva contraseña.'
                : 'Indica tu número de celular o el correo de recuperación que registraste.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Revisa la carpeta de spam. El enlace caduca al cabo de un tiempo por seguridad.
                </p>
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
                <div className="space-y-2">
                  <Label htmlFor="forgot-id">Celular o correo</Label>
                  <Input
                    id="forgot-id"
                    type="text"
                    autoComplete="username"
                    placeholder="5512345678 o tu@correo.com"
                    className={cn(
                      'h-10',
                      form.formState.errors.identifier && 'border-destructive aria-invalid:border-destructive',
                    )}
                    aria-invalid={!!form.formState.errors.identifier}
                    {...form.register('identifier')}
                  />
                  {form.formState.errors.identifier ? (
                    <p className="text-xs text-destructive" role="alert">
                      {form.formState.errors.identifier.message}
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
