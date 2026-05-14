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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'POST') return err('Método no permitido', 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return err('No autorizado', 401)
  }

  let body: { userId?: string; newPassword?: string }
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido', 400)
  }

  const targetId = String(body.userId ?? '').trim()
  const newPassword = String(body.newPassword ?? '').trim()
  if (!targetId) return err('Usuario no válido', 400)
  if (newPassword.length < 6) return err('La contraseña debe tener al menos 6 caracteres', 400)

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

  const { data: actor, error: actorErr } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single()

  if (actorErr || !actor) return err('Sin permisos', 403)
  const actorRole = (actor as { role: string }).role
  if (!['admin', 'super_admin'].includes(actorRole)) return err('Sin permisos', 403)

  const { error: pwErr } = await admin.auth.admin.updateUserById(targetId, {
    password: newPassword,
  })
  if (pwErr) return err(pwErr.message, 400)

  return ok({ success: true })
})
