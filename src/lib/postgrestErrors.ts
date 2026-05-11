/**
 * PostgREST devuelve 404 cuando la tabla/vista no existe o no está en la caché de esquema
 * (p. ej. migración `017_group_categories.sql` aún no aplicada en el proyecto remoto).
 *
 * Nota: el navegador seguirá mostrando la petición en rojo en la pestaña Red hasta que la
 * tabla exista; aquí solo alineamos el manejo en código cuando el cuerpo del error varía.
 */
export function isMissingPostgrestRelationError(
  error: {
    code?: string | number
    message?: string
    details?: string
    hint?: string
  } | null | undefined,
): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  const msg = (error.message ?? '').toLowerCase()
  const details = (error.details ?? '').toLowerCase()
  const hint = (error.hint ?? '').toLowerCase()
  const haystack = `${code} ${msg} ${details} ${hint}`.toLowerCase()
  const status = (error as { status?: number; statusCode?: number }).status ?? (error as { statusCode?: number }).statusCode

  if (code === 'PGRST205' || code === '42P01') return true
  if (haystack.includes('schema cache') || haystack.includes('could not find the table')) return true
  if (haystack.includes('does not exist')) return true
  // Algunas respuestas mínimas ante recurso desconocido
  if (status === 404 && (msg === 'not found' || msg.includes('requested resource not found'))) return true
  return false
}
