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

function err(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, error: message }), {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'POST') return err('Método no permitido', 405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`resolve:${ip}`, 40, 60_000)) {
    return err('Demasiados intentos. Espera un momento.', 429)
  }

  let body: { phone?: string }
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido', 400)
  }

  const parsed = normalizePhone(String(body.phone ?? ''))
  if (!parsed.ok) {
    return err('No encontramos una cuenta con ese número.', 404)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: row, error } = await admin.from('profiles').select('id').eq('phone', parsed.digits).maybeSingle()
  if (error || !row) {
    return err('No encontramos una cuenta con ese número.', 404)
  }

  const uid = (row as { id: string }).id
  const { data: userData, error: uErr } = await admin.auth.admin.getUserById(uid)
  if (uErr || !userData?.user?.email) {
    return err('No encontramos una cuenta con ese número.', 404)
  }

  return ok({ success: true, auth_email: userData.user.email })
})
