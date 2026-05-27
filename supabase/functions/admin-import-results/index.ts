// @ts-nocheck — Edge Function Deno; validación en runtime.
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

function humanize(msg: string): string {
  const m = String(msg ?? '')
  if (m.includes('El ganador debe ser el jugador A o B')) {
    return 'El ganador no pertenece a este partido (debe ser jugador A o B del cruce).'
  }
  if (m.includes('Indica el ganador del partido')) {
    return 'Falta ganador para este tipo de resultado.'
  }
  if (m.includes('Solo staff')) {
    return 'No tienes permisos para aplicar este resultado.'
  }
  if (m.includes('Partido no encontrado')) {
    return 'El partido ya no existe en la base de datos.'
  }
  return m || 'No se pudo guardar el resultado.'
}

type ImportRow = {
  rowNumber: number
  matchId: string
  cancelled: boolean
  scoreRaw: { a: number; b: number }[] | null
  winnerGroupPlayerId: string | null
  status: string
  resultType: string
  gameType: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  if (req.method !== 'POST') return err('Método no permitido', 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return err('No autorizado', 401)

  let body: { rows?: ImportRow[] }
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido', 400)
  }

  const rows = Array.isArray(body.rows) ? body.rows : []
  if (rows.length === 0) return err('rows vacío', 400)
  if (rows.length > 120) return err('Máximo 120 filas por lote', 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return err('No autorizado', 401)

  const { data: actor, error: actorErr } = await userClient
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single()

  if (actorErr || !actor) return err('Sin permisos', 403)
  const role = (actor as { role: string }).role
  if (!['admin', 'super_admin'].includes(role)) return err('Solo administradores pueden importar resultados', 403)

  const results: { rowNumber: number; ok: boolean; message?: string }[] = []

  for (const r of rows) {
    try {
      if (r.cancelled) {
        const { error: upErr } = await userClient
          .from('matches')
          .update({
            status: 'cancelled',
            winner_id: null,
            score_raw: null,
            result_type: 'normal',
            updated_by: userData.user.id,
            updated_at: new Date().toISOString(),
            closed_at: null,
            admin_validated_at: null,
            admin_validated_by: null,
          })
          .eq('id', r.matchId)
        if (upErr) throw new Error(upErr.message)
      } else if (r.status === 'pending_score' && !r.scoreRaw && !r.winnerGroupPlayerId) {
        const { error: upErr } = await userClient
          .from('matches')
          .update({
            status: 'pending_score',
            winner_id: null,
            score_raw: null,
            result_type: 'normal',
            game_type: r.gameType,
            updated_by: userData.user.id,
            updated_at: new Date().toISOString(),
            closed_at: null,
            admin_validated_at: null,
            admin_validated_by: null,
            score_submitted_by: null,
            score_submitted_at: null,
            opponent_confirmed_by: null,
            opponent_confirmed_at: null,
          })
          .eq('id', r.matchId)
        if (upErr) throw new Error(upErr.message)
      } else {
        const pScore = r.scoreRaw
        const { error: rpcErr } = await userClient.rpc('admin_set_match_result', {
          p_match_id: r.matchId,
          p_score: pScore,
          p_winner_id: r.winnerGroupPlayerId,
          p_status: r.status,
          p_result_type: r.resultType,
          p_game_type: r.gameType,
        })
        if (rpcErr) throw new Error(rpcErr.message)
      }
      results.push({ rowNumber: r.rowNumber, ok: true })
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      results.push({ rowNumber: r.rowNumber, ok: false, message: humanize(raw) })
    }
  }

  return ok({ results })
})
