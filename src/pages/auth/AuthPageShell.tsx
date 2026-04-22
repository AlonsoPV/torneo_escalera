import type { ReactNode } from 'react'

/** Fondo compartido para pantallas de login / registro. */
export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,oklch(0.65_0.17_145/0.14),transparent_55%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,oklch(0.55_0.14_145/0.22),transparent_55%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-background" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
