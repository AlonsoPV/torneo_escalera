/**
 * Crea un usuario vía supabase.auth.signUp (misma lógica que el registro web).
 * Uso: node scripts/create-user.mjs <email> <password> [nombre_completo]
 * No añas credenciales a este archivo.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const raw = readFileSync(join(__dirname, '../.env'), 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i)
    let v = t.slice(i + 1).replace(/\r$/, '')
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[k] = v
  }
  return env
}

const [, , email, password, fullName = 'Jugador'] = process.argv
if (!email || !password) {
  console.error('Uso: node scripts/create-user.mjs <email> <password> [nombre_completo]')
  process.exit(1)
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env')
  process.exit(1)
}

const supabase = createClient(url, key)
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name: fullName } },
})

if (error) {
  console.error('Error:', error.message)
  process.exit(1)
}

if (data.session) {
  console.log('Usuario creado y sesión iniciada (id:', data.user?.id + ').')
} else {
  console.log('Usuario creado; revisa el correo para confirmar si el proyecto lo requiere (id:', data.user?.id + ').')
}
