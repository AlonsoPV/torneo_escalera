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

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido', 400)
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  if (!email || !isValidEmail(email)) {
    return err('Correo no válido', 400)
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

  const { data: dup, error: dupErr } = await admin
    .from('profiles')
    .select('id')
    .neq('id', uid)
    .eq('email', email)
    .maybeSingle()

  if (dupErr) return err(dupErr.message, 500)
  if (dup) return err('Ese correo ya está registrado en otra cuenta', 409)

  const { error: authUpErr } = await admin.auth.admin.updateUserById(uid, {
    email,
    email_confirm: true,
  })
  if (authUpErr) return err(authUpErr.message, 400)

  const { error: profErr } = await admin
    .from('profiles')
    .update({
      email,
      email_verified: false,
      must_complete_email: false,
    })
    .eq('id', uid)

  if (profErr) return err(profErr.message, 500)

  return ok({ success: true })
})
