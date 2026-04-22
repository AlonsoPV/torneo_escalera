import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUpWithEmail } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const schema = z
  .object({
    fullName: z.string().min(2, 'Nombre muy corto'),
    email: z.string().email(),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirm: z.string().min(6),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  })

type Form = z.infer<typeof schema>

export function RegisterPage() {
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.initialized)

  const form = useForm<Form>({ resolver: zodResolver(schema) })

  if (initialized && session) {
    return <Navigate to="/player" replace />
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-md p-6 text-sm text-muted-foreground">
        Configura <code className="rounded bg-muted px-1">.env</code> con las variables de Supabase
        antes de registrarte.
      </div>
    )
  }

  const submit = form.handleSubmit(async (values) => {
    try {
      await signUpWithEmail(values.email, values.password, values.fullName)
      toast.success('Revisa tu correo para confirmar la cuenta (si está habilitado).')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al registrarse')
    }
  })

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
          <CardDescription>Se creará tu perfil como jugador por defecto.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre</Label>
              <Input id="fullName" {...form.register('fullName')} />
              {form.formState.errors.fullName ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.fullName.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
              {form.formState.errors.email ? (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...form.register('password')}
              />
              {form.formState.errors.password ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...form.register('confirm')}
              />
              {form.formState.errors.confirm ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.confirm.message}
                </p>
              ) : null}
            </div>
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              Registrarme
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/login">
              Inicia sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
