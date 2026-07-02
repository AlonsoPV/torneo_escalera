/** Basename de React Router según `base` de Vite (p. ej. `/torneo_escalera/` en GitHub Pages). */
export function routerBasename(): string | undefined {
  const base = import.meta.env.BASE_URL
  if (!base || base === '/') return undefined
  return base.replace(/\/$/, '')
}
