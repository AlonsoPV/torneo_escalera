import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Lock, Smartphone, Trophy } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resolvePostLoginPath, signInWithPhone } from '@/lib/auth'
import { normalizePhone } from '@/lib/phone'
import { clearLocalAuthAndGoToLogin } from '@/lib/authSessionRecovery'
import { cn } from '@/lib/utils'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { AuthPageShell } from '@/pages/auth/AuthPageShell'

const schema = z.object({
  phone: z.string().min(1, 'Introduce tu número de celular'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type Form = z.infer<typeof schema>

export function LoginPage() {
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  const initialized = useAuthStore((s) => s.initialized)
  const location = useLocation()
  const navigate = useNavigate()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { phone: '', password: '' } })

  if (initialized && session) {
    return <Navigate to={resolvePostLoginPath(profile, from)} replace />
  }

  if (!isSupabaseConfigured) {
    return (
      <AuthPageShell>
        <div className="mx-auto flex min-h-dvh max-w-6xl items-center justify-center p-6">
          <Card className="w-full max-w-md border-border/60 shadow-lg shadow-black/5">
            <CardHeader className="space-y-1 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-muted">
                  <Trophy className="size-5 text-muted-foreground" aria-hidden />
                </div>
                <div>
                  <CardTitle className="text-lg">Configuración pendiente</CardTitle>
                  <CardDescription>Conecta Supabase para poder iniciar sesión.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              Añade en <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">.env</code>{' '}
              las variables{' '}
              <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">VITE_SUPABASE_URL</code>{' '}
              y{' '}
              <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                VITE_SUPABASE_ANON_KEY
              </code>
              , reinicia el servidor de desarrollo y vuelve a esta página.
            </CardContent>
          </Card>
        </div>
      </AuthPageShell>
    )
  }

  const submit = form.handleSubmit(async (values) => {
    const parsed = normalizePhone(values.phone)
    if (!parsed.ok) {
      form.setError('phone', { type: 'manual', message: parsed.error })
      return
    }
    try {
      const authData = await signInWithPhone(values.phone, values.password)
      if (authData.session) {
        useAuthStore.getState().setSession(authData.session)
        await useAuthStore.getState().refreshProfile()
        const p = useAuthStore.getState().profile
        toast.success('Sesión iniciada')
        navigate(resolvePostLoginPath(p, from), { replace: true })
      } else {
        toast.warning('No pudimos completar el acceso. Intenta de nuevo o contacta al administrador si sigue fallando.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al iniciar sesión')
    }
  })

  return (
    <AuthPageShell>
      <div className="mx-auto grid min-h-dvh max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-0">
        <aside className="relative hidden flex-col justify-between border-border/50 px-10 py-12 lg:flex lg:border-r">
          <div>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-emerald-500/90" aria-hidden />
              Panel de torneos
            </div>
            <h1 className="max-w-sm text-balance text-3xl font-semibold tracking-tight text-foreground">
              Organiza torneos y sigue los partidos en un solo lugar.
            </h1>
            <p className="mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
              Accede con tu cuenta para gestionar competiciones, cuadros y resultados.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <Trophy className="size-5" aria-hidden />
            </div>
            <p className="leading-snug">
              <span className="font-medium text-foreground">Torneo Mega Varonil</span>
              <br />
              Herramienta para clubes y organizadores.
            </p>
          </div>
        </aside>

        <main className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <Trophy className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Torneo Mega Varonil</p>
              <p className="text-xs text-muted-foreground">Inicia sesión para continuar</p>
            </div>
          </div>

          <Card className="border-border/60 shadow-xl shadow-black/[0.04] dark:shadow-black/20">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-semibold tracking-tight">Bienvenido de nuevo</CardTitle>
              <CardDescription className="text-base">
                Introduce tu número de celular y contraseña para entrar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={submit} noValidate>
                <div className="space-y-2">
                  <Label htmlFor="phone">Número de celular</Label>
                  <div className="relative">
                    <Smartphone
                      className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="Ej. 5512345678"
                      className={cn(
                        'h-10 pl-9',
                        form.formState.errors.phone && 'border-destructive aria-invalid:border-destructive',
                      )}
                      aria-invalid={!!form.formState.errors.phone}
                      {...form.register('phone')}
                    />
                  </div>
                  {form.formState.errors.phone ? (
                    <p className="text-xs text-destructive" role="alert">
                      {form.formState.errors.phone.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
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
                <Button className="h-10 w-full gap-2 text-base font-medium" type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Iniciando sesión…
                    </>
                  ) : (
                    'Iniciar sesión'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full text-sm"
                  onClick={() => {
                    void clearLocalAuthAndGoToLogin()
                  }}
                >
                  Limpiar sesión y volver a iniciar
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  Usa esta opción si ves errores de sesión o la pantalla se queda en blanco.
                </p>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </AuthPageShell>
  )
}
