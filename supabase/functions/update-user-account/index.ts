import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

import { formatAuthPasswordError, isPasswordLongEnough, passwordMinLengthError } from '../_shared/passwordPolicy.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

function err(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizePhone(raw: string): { ok: true; digits: string } | { ok: false; error: string } {
  let s = String(raw ?? '').trim()
  s = s.replace(/[\s\-().]/g, '')
  if (s.startsWith('+52')) s = s.slice(3)
  let digits = s.replace(/\D/g, '')
  while (digits.startsWith('52') && digits.length > 10) digits = digits.slice(2)
  if (digits.length < 10) return { ok: false, error: 'El numero debe tener al menos 10 digitos.' }
  if (digits.length > 13) return { ok: false, error: 'El numero no puede tener mas de 13 digitos.' }
  return { ok: true, digits }
}

function technicalAuthEmailFromDigits(digits: string): string {
  return `${digits}@mega-varonil.local`
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'POST') return err('Metodo no permitido', 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return err('No autorizado', 401)

  let body: {
    fullName?: string
    phone?: string
    recoveryEmail?: string | null
    newPassword?: string
  }
  try {
    body = await req.json()
  } catch {
    return err('JSON invalido', 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return err('No autorizado', 401)
  const uid = userData.user.id

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: currentProfile, error: currentErr } = await admin
    .from('profiles')
    .select('id, phone, email, full_name')
    .eq('id', uid)
    .maybeSingle()
  if (currentErr) return err(currentErr.message, 500)
  if (!currentProfile) return err('Perfil no encontrado', 404)

  const patch: Record<string, unknown> = {}
  let changed = false

  if (Object.prototype.hasOwnProperty.call(body, 'fullName')) {
    const fullName = String(body.fullName ?? '').trim()
    if (fullName.length < 2) return err('El nombre debe tener al menos 2 caracteres.', 400)
    const prev = String((currentProfile as { full_name?: string | null }).full_name ?? '').trim()
    if (fullName !== prev) {
      patch.full_name = fullName
      changed = true
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'phone')) {
    const parsed = normalizePhone(String(body.phone ?? ''))
    if (!parsed.ok) return err(parsed.error, 400)
    const prev = String((currentProfile as { phone?: string | null }).phone ?? '').trim()
    if (parsed.digits !== prev) {
      const { data: dupPhone, error: dupPhoneErr } = await admin
        .from('profiles')
        .select('id')
        .eq('phone', parsed.digits)
        .neq('id', uid)
        .maybeSingle()
      if (dupPhoneErr) return err(dupPhoneErr.message, 500)
      if (dupPhone) return err('Ese celular ya esta registrado en otra cuenta.', 409)

      const tech = technicalAuthEmailFromDigits(parsed.digits)
      const { error: authUpErr } = await admin.auth.admin.updateUserById(uid, {
        email: tech,
        email_confirm: true,
      })
      if (authUpErr) return err(authUpErr.message, 400)

      patch.phone = parsed.digits
      changed = true
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'recoveryEmail')) {
    const raw = body.recoveryEmail
    const nextEmail = raw == null || String(raw).trim() === '' ? null : String(raw).trim().toLowerCase()
    if (nextEmail && !isValidEmail(nextEmail)) return err('Correo no valido', 400)

    const prev = String((currentProfile as { email?: string | null }).email ?? '').trim().toLowerCase() || null
    if (nextEmail !== prev) {
      if (nextEmail) {
        const { data: dupEmail, error: dupEmailErr } = await admin
          .from('profiles')
          .select('id')
          .eq('email', nextEmail)
          .neq('id', uid)
          .maybeSingle()
        if (dupEmailErr) return err(dupEmailErr.message, 500)
        if (dupEmail) return err('Ese correo ya esta registrado en otra cuenta.', 409)
      }
      patch.email = nextEmail
      patch.email_verified = false
      patch.must_complete_email = nextEmail == null
      changed = true
    }
  }

  const newPassword = String(body.newPassword ?? '').trim()
  if (newPassword) {
    if (!isPasswordLongEnough(newPassword)) {
      return err(`${passwordMinLengthError('La contrasena')}.`, 400)
    }
    const { error: pwErr } = await admin.auth.admin.updateUserById(uid, { password: newPassword })
    if (pwErr) return err(formatAuthPasswordError(pwErr.message), 400)
    const { error: credErr } = await admin.from('admin_user_credentials').upsert({
      user_id: uid,
      password_plain: newPassword,
      updated_by: uid,
      updated_at: new Date().toISOString(),
    })
    if (credErr) return err(credErr.message, 500)
    changed = true
  }

  if (Object.keys(patch).length > 0) {
    const { error: profErr } = await admin.from('profiles').update(patch).eq('id', uid)
    if (profErr) return err(profErr.message, 500)
  }

  if (!changed) {
    return ok({ success: true, unchanged: true })
  }

  return ok({ success: true })
})
