import { FunctionsHttpError } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/database'

function requireAnonKey(): string {
  const k = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!k) throw new Error('Falta VITE_SUPABASE_ANON_KEY')
  return k
}

async function readFunctionsErrorBody(error: unknown): Promise<{ error?: string; code?: string } | null> {
  if (!(error instanceof FunctionsHttpError)) return null
  const res = error.context as Response
  try {
    const ct = res.headers.get('Content-Type') ?? ''
    if (!ct.includes('application/json')) return null
    return (await res.clone().json()) as { error?: string; code?: string }
  } catch {
    return null
  }
}

const GENERIC_PHONE_NOT_FOUND = 'No encontramos una cuenta con ese número.'

export async function invokeResolveAuthEmailByPhone(phone: string): Promise<string> {
  const anonKey = requireAnonKey()
  const { data, error } = await supabase.functions.invoke<{
    success?: boolean
    auth_email?: string
    error?: string
  }>('resolve-auth-email-by-phone', {
    body: { phone },
    headers: { apikey: anonKey },
  })

  const payload = data && typeof data === 'object' ? data : null
  const authEmail = payload?.auth_email?.trim()

  if (authEmail && payload?.success !== false) {
    return authEmail
  }

  let failMsg = payload?.error ?? GENERIC_PHONE_NOT_FOUND
  if (error) {
    const parsed = await readFunctionsErrorBody(error)
    if (parsed?.error) failMsg = parsed.error
    throw new Error(failMsg)
  }

  if (payload?.success === false) {
    throw new Error(failMsg)
  }

  throw new Error(GENERIC_PHONE_NOT_FOUND)
}

export class PasswordResetRequestError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'PasswordResetRequestError'
    this.code = code
  }
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

  if (!error && data?.error) {
    throw new PasswordResetRequestError(data.error, data.code)
  }

  if (error instanceof FunctionsHttpError) {
    const parsed = await readFunctionsErrorBody(error)
    if (parsed?.error) {
      throw new PasswordResetRequestError(parsed.error, parsed.code)
    }
    throw new PasswordResetRequestError('No se pudo procesar la solicitud')
  }

  if (error) {
    throw new PasswordResetRequestError(error.message)
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
