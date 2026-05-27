// Admin: celular (+ email técnico @mega-varonil.local en Auth) y correo de recuperación (solo profiles.email).
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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

type NormalizePhoneResult =
  | { ok: true; digits: string }
  | { ok: false; error: string }

function normalizePhone(raw: string): NormalizePhoneResult {
  let s = String(raw ?? '').trim()
  s = s.replace(/[\s\-().]/g, '')
  if (s.startsWith('+52')) {
    s = s.slice(3)
  }
  let digits = s.replace(/\D/g, '')
  while (digits.startsWith('52') && digits.length > 10) {
    digits = digits.slice(2)
  }
  if (digits.length < 10) {
    return { ok: false, error: 'El número debe tener al menos 10 dígitos.' }
  }
  if (digits.length > 13) {
    return { ok: false, error: 'El número no puede tener más de 13 dígitos.' }
  }
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
  if (req.method !== 'POST') return err('Método no permitido', 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return err('No autorizado', 401)
  }

  let body: {
    userId?: string
    /** Teléfono normalizado desde el cliente o bruto — se normaliza aquí también. */
    phone?: string | null
    /** null o "" → sin correo de recuperación. Si se omite la clave → no cambia. */
    recoveryEmail?: string | null
  }

  try {
    body = await req.json()
  } catch {
    return err('JSON inválido', 400)
  }

  const targetId = String(body.userId ?? '').trim()
  if (!targetId) return err('Usuario no válido', 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return err('No autorizado', 401)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: actor, error: actorErr } = await admin.from('profiles').select('id, role').eq('id', userData.user.id).single()

  if (actorErr || !actor) return err('Sin permisos', 403)
  const actorRole = (actor as { role: string }).role
  if (!['admin', 'super_admin'].includes(actorRole)) return err('Sin permisos', 403)

  const { data: targetProfile, error: tpErr } = await admin.from('profiles').select('phone, email').eq('id', targetId).maybeSingle()

  if (tpErr) return err(tpErr.message, 500)
  if (!targetProfile) return err('Usuario no encontrado', 404)

  const patch: Record<string, unknown> = {}
  let phoneProvided = Object.prototype.hasOwnProperty.call(body, 'phone')

  if (phoneProvided) {
    if (body.phone == null || String(body.phone).trim() === '') {
      return err('El celular no puede estar vacío', 400)
    }
    const parsed = normalizePhone(String(body.phone))
    if (!parsed.ok) return err(parsed.error, 400)
    const digits = parsed.digits
    const prevPhone = ((targetProfile as { phone?: string | null }).phone ?? '').trim()
    if (digits !== prevPhone) {
      const { data: dupPh } = await admin.from('profiles').select('id').eq('phone', digits).neq('id', targetId).maybeSingle()

      if (dupPh) return err('Ya existe un usuario con ese número de celular', 409)

      const tech = technicalAuthEmailFromDigits(digits)
      const { error: authUpErr } = await admin.auth.admin.updateUserById(targetId, {
        email: tech,
      })
      if (authUpErr) return err(authUpErr.message, 400)

      patch.phone = digits
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'recoveryEmail')) {
    const raw = body.recoveryEmail
    let nextEmail: string | null
    if (raw == null || String(raw).trim() === '') {
      nextEmail = null
    } else {
      const em = String(raw).trim().toLowerCase()
      if (!isValidEmail(em)) return err('Correo de recuperación no válido', 400)
      nextEmail = em
      const { data: dup, error: dupErr } = await admin
        .from('profiles')
        .select('id')
        .neq('id', targetId)
        .eq('email', nextEmail)
        .maybeSingle()

      if (dupErr) return err(dupErr.message, 500)
      if (dup) return err('Ese correo ya está registrado en otra cuenta', 409)
    }

    const prev = ((targetProfile as { email?: string | null }).email ?? '').trim().toLowerCase() || null
    if ((nextEmail ?? null) !== (prev ?? null)) {
      patch.email = nextEmail
      patch.must_complete_email = nextEmail == null ? true : false
      patch.email_verified = false
    }
  }

  if (Object.keys(patch).length > 0) {
    const { error: profErr } = await admin.from('profiles').update(patch).eq('id', targetId)
    if (profErr) return err(profErr.message, 500)
  }

  return ok({ success: true })
})
