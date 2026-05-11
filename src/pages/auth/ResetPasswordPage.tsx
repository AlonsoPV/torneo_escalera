import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Lock, Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updatePassword } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { AuthPageShell } from '@/pages/auth/AuthPageShell'

const schema = z
  .object({
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirm: z.string().min(1, 'Confirma la contraseña'),
  })
  .refine((d) => d.password === d.confirm, { message: 'Las contraseñas no coinciden', path: ['confirm'] })

type Form = z.infer<typeof schema>

type Phase = 'loading' | 'ready' | 'invalid'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const [phase, setPhase] = useState<Phase>('loading')
  const recoverySeen = useRef(false)
  const initialHashRef = useRef(typeof window !== 'undefined' ? window.location.hash : '')

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setPhase('invalid')
      return
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoverySeen.current = true
        setPhase('ready')
      }
    })

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && initialHashRef.current.includes('type=recovery')) {
        recoverySeen.current = true
        setPhase('ready')
      }
    })

    const t = window.setTimeout(() => {
      if (!recoverySeen.current) {
        setPhase('invalid')
      }
    }, 4000)

    return () => {
      subscription.unsubscribe()
      window.clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'ready') return
    const clean = `${window.location.pathname}${window.location.search}`
    window.history.replaceState({}, '', clean)
  }, [phase])

  const submit = form.handleSubmit(async (values) => {
    try {
      await updatePassword(values.password)
      const { data } = await supabase.auth.getSession()
      setSession(data.session ?? null)
      await refreshProfile()
      toast.success('Contraseña actualizada')
      navigate('/', { replace: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar la contraseña')
    }
  })

  if (!isSupabaseConfigured) {
    return (
      <AuthPageShell>
        <div className="mx-auto flex min-h-dvh max-w-6xl items-center justify-center p-6">
          <Card className="w-full max-w-md border-border/60 shadow-lg shadow-black/5">
            <CardHeader>
              <CardTitle className="text-lg">Configuración pendiente</CardTitle>
              <CardDescription>Conecta Supabase para restablecer la contraseña.</CardDescription>
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

  if (phase === 'loading') {
    return (
      <AuthPageShell>
        <div className="mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center gap-4 p-6">
          <Loader2 className="size-10 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Validando enlace…</p>
        </div>
      </AuthPageShell>
    )
  }

  if (phase === 'invalid') {
    return (
      <AuthPageShell>
        <div className="mx-auto flex min-h-dvh max-w-6xl items-center justify-center p-6">
          <Card className="w-full max-w-md border-border/60 shadow-lg shadow-black/5">
            <CardHeader>
              <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-muted">
                <Trophy className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <CardTitle className="text-xl">Enlace no válido o caducado</CardTitle>
              <CardDescription>
                Solicita un nuevo correo de recuperación desde la pantalla de inicio de sesión.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Link to="/forgot-password" className={cn(buttonVariants(), 'inline-flex w-full justify-center')}>
                Solicitar nuevo enlace
              </Link>
              <Link
                to="/login"
                className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex w-full justify-center')}
              >
                Volver al inicio de sesión
              </Link>
            </CardContent>
          </Card>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell>
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md border-border/60 shadow-lg shadow-black/5">
          <CardHeader className="space-y-1">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <Lock className="size-5" aria-hidden />
              </div>
              <CardTitle className="text-xl font-semibold tracking-tight">Nueva contraseña</CardTitle>
            </div>
            <CardDescription className="text-base">Elige una contraseña segura para tu cuenta.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={submit} noValidate>
              <div className="space-y-2">
                <Label htmlFor="reset-password">Nueva contraseña</Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className={cn(
                      'h-10 pl-9',
                      form.formState.errors.password && 'border-destructive aria-invalid:border-destructive',
                    )}
                    aria-invalid={!!form.formState.errors.password}
                    {...form.register('password')}
                  />
                </div>
                {form.formState.errors.password ? (
                  <p className="text-xs text-destructive" role="alert">
                    {form.formState.errors.password.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="reset-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className={cn(
                      'h-10 pl-9',
                      form.formState.errors.confirm && 'border-destructive aria-invalid:border-destructive',
                    )}
                    aria-invalid={!!form.formState.errors.confirm}
                    {...form.register('confirm')}
                  />
                </div>
                {form.formState.errors.confirm ? (
                  <p className="text-xs text-destructive" role="alert">
                    {form.formState.errors.confirm.message}
                  </p>
                ) : null}
              </div>
              <Button className="h-10 w-full gap-2 text-base font-medium" type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Guardando…
                  </>
                ) : (
                  'Guardar contraseña'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AuthPageShell>
  )
}
