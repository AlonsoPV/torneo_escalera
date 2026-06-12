type MetricDetail = Record<string, string | number | boolean | null | undefined>

const enabled =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('perf')

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function logPerfMetric(name: string, durationMs: number, detail?: MetricDetail) {
  if (!enabled) return
  console.info('[perf]', name, {
    durationMs: Math.round(durationMs),
    ...detail,
  })
}

export async function measureAsync<T>(name: string, fn: () => Promise<T>, detail?: MetricDetail): Promise<T> {
  const start = now()
  try {
    return await fn()
  } finally {
    logPerfMetric(name, now() - start, detail)
  }
}
