import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

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

const rateLimitBuckets = new Map<string, number[]>()

function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const arr = (rateLimitBuckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (arr.length >= max) return false
  arr.push(now)
  rateLimitBuckets.set(key, arr)
  return true
}

function err(message: string, status: number, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
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

function looksLikeEmail(s: string): boolean {
  return s.includes('@')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'POST') return err('Método no permitido', 405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`recover:${ip}`, 15, 60_000)) {
    return err('Demasiados intentos. Espera un momento.', 429)
  }

  let body: { identifier?: string; redirectTo?: string | null }
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido', 400)
  }

  const rawId = String(body.identifier ?? '').trim()
  if (!rawId) return err('Indica tu celular o correo', 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!.replace(/\/$/, '')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let profileId: string | null = null
  let recoveryEmail: string | null = null

  if (looksLikeEmail(rawId)) {
    const emailNorm = rawId.trim().toLowerCase()
    const { data: row } = await admin.from('profiles').select('id, email').eq('email', emailNorm).maybeSingle()
    if (row) {
      profileId = (row as { id: string }).id
      recoveryEmail = (row as { email: string | null }).email
    }
  } else {
    const parsed = normalizePhone(rawId)
    if (!parsed.ok) {
      return err(parsed.error, 400)
    }
    const { data: row } = await admin.from('profiles').select('id, email').eq('phone', parsed.digits).maybeSingle()
    if (row) {
      profileId = (row as { id: string }).id
      recoveryEmail = (row as { email: string | null }).email
    }
  }

  if (!profileId) {
    return ok({
      success: true,
      message: 'Si existe una cuenta, recibirás un correo con instrucciones.',
    })
  }

  if (!recoveryEmail || recoveryEmail.trim() === '') {
    return err(
      'Aún no tienes un correo registrado. Contacta al administrador.',
      400,
      { code: 'no_recovery_email' },
    )
  }

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(profileId)
  if (authErr || !authUser?.user?.email) {
    return ok({
      success: true,
      message: 'Si existe una cuenta, recibirás un correo con instrucciones.',
    })
  }

  const authEmail = authUser.user.email
  const redirectTo =
    (typeof body.redirectTo === 'string' && body.redirectTo.trim()) ||
    Deno.env.get('PASSWORD_RESET_REDIRECT_URL') ||
    ''

  const recoverUrl = `${supabaseUrl}/auth/v1/recover`
  const recoverRes = await fetch(recoverUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      email: authEmail,
      ...(redirectTo ? { redirect_to: redirectTo } : {}),
    }),
  })

  if (!recoverRes.ok) {
    const txt = await recoverRes.text()
    console.error('recover failed', recoverRes.status, txt)
    return err('No se pudo enviar el correo de recuperación. Intenta más tarde.', 502)
  }

  return ok({
    success: true,
    message: 'Si existe una cuenta con ese dato, recibirás un correo con instrucciones.',
  })
})
