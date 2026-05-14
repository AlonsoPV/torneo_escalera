/** Tiempo máximo por petición HTTP (Supabase REST, Auth, Storage, Edge invoke). */
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000

export function isAbortLike(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: string; message?: string }
  return e.name === 'AbortError' || (typeof e.message === 'string' && /abort/i.test(e.message))
}

/**
 * `fetch` con cancelación automática tras `DEFAULT_REQUEST_TIMEOUT_MS`.
 * Respeta `signal` del caller: si aborta, se cancela la petición y el temporizador.
 */
export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeoutCtrl = new AbortController()
  const timeoutId = globalThis.setTimeout(() => timeoutCtrl.abort(), DEFAULT_REQUEST_TIMEOUT_MS)

  const outer = init?.signal
  const merged = new AbortController()

  const abortMerged = () => {
    if (!merged.signal.aborted) merged.abort()
  }

  const onTimeout = () => abortMerged()
  const onOuterAbort = () => {
    globalThis.clearTimeout(timeoutId)
    abortMerged()
  }

  timeoutCtrl.signal.addEventListener('abort', onTimeout, { once: true })
  if (outer) {
    if (outer.aborted) {
      globalThis.clearTimeout(timeoutId)
      abortMerged()
      return Promise.reject(new DOMException('Aborted', 'AbortError'))
    }
    outer.addEventListener('abort', onOuterAbort, { once: true })
  }

  return fetch(input, { ...init, signal: merged.signal }).finally(() => {
    globalThis.clearTimeout(timeoutId)
    outer?.removeEventListener('abort', onOuterAbort)
    timeoutCtrl.signal.removeEventListener('abort', onTimeout)
  })
}
