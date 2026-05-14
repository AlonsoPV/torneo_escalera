import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

type Props = { children: ReactNode }
type State = { hasError: boolean }

/** Captura errores de render/hijos para evitar pantalla en blanco silenciosa. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <h1 className="text-lg font-semibold text-foreground">Algo salió mal</h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            La aplicación encontró un error inesperado. Puedes reintentar recargando la página.
          </p>
          <Button type="button" onClick={() => globalThis.location.reload()}>
            Reintentar
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
