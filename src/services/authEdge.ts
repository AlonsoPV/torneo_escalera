import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/database'

function requireAnonKey(): string {
  const k = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!k) throw new Error('Falta VITE_SUPABASE_ANON_KEY')
  return k
}

export async function invokeResolveAuthEmailByPhone(phone: string): Promise<string> {
  const anonKey = requireAnonKey()
  const { data, error } = await supabase.functions.invoke<{ auth_email?: string; error?: string }>(
    'resolve-auth-email-by-phone',
    {
      body: { phone },
      headers: { apikey: anonKey },
    },
  )
  if (error) throw new Error(error.message)
  const authEmail = data?.auth_email
  if (!authEmail) throw new Error(data?.error ?? 'No encontramos una cuenta con ese número.')
  return authEmail
}

export async function invokePasswordResetRequest(identifier: string, redirectTo: string): Promise<void> {
  const anonKey = requireAnonKey()
  const { data, error } = await supabase.functions.invoke<{
    success?: boolean
    error?: string
    code?: string
    message?: string
  }>('password-reset-request', {
    body: { identifier, redirectTo },
    headers: { apikey: anonKey },
  })
  if (error) throw new Error(error.message)
  if (data?.error) {
    throw new Error(data.error)
  }
}

export async function invokeUpdateUserRecoveryEmail(email: string): Promise<void> {
  const anonKey = requireAnonKey()
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Inicia sesión para guardar tu correo.')
  const { data, error } = await supabase.functions.invoke<{ error?: string }>('update-user-recovery-email', {
    body: { email },
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  })
  if (error) throw new Error(error.message)
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }
}

export async function invokeAdminCreateUser(input: {
  fullName: string
  phone: string
  temporaryPassword: string
  role: UserRole
  categoryId: string
  groupId?: string
  tournamentId?: string | null
}): Promise<void> {
  const anonKey = requireAnonKey()
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Inicia sesión como administrador.')
  const { data, error } = await supabase.functions.invoke<{ error?: string }>('admin-create-user', {
    body: {
      fullName: input.fullName,
      phone: input.phone,
      temporaryPassword: input.temporaryPassword,
      role: input.role,
      categoryId: input.categoryId,
      groupId: input.groupId ?? null,
      tournamentId: input.tournamentId ?? null,
    },
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  })
  if (error) throw new Error(error.message)
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }
}

export async function invokeAdminChangeUserPassword(input: { userId: string; newPassword: string }): Promise<void> {
  const anonKey = requireAnonKey()
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Inicia sesión como administrador.')
  const { data, error } = await supabase.functions.invoke<{ error?: string }>('admin-change-user-password', {
    body: { userId: input.userId, newPassword: input.newPassword },
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  })
  if (error) throw new Error(error.message)
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }
}
