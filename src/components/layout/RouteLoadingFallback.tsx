import { Skeleton } from '@/components/ui/skeleton'

/** Fallback visible durante carga inicial de rutas lazy o hidratación del router. */
export function RouteLoadingFallback() {
  return (
    <div
      className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6"
      aria-busy="true"
      aria-live="polite"
      aria-label="Cargando contenido"
    >
      <Skeleton className="h-9 w-52 max-w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-2xl sm:h-44" />
      <Skeleton className="h-28 w-full rounded-2xl sm:h-32" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  )
}
