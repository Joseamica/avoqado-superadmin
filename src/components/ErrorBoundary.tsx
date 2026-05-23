import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // TODO(observability): cuando integremos Sentry, enviar aquí:
    //   Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset)
      return <DefaultErrorFallback error={this.state.error} onReset={this.reset} />
    }
    return this.props.children
  }
}

function DefaultErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center bg-[var(--canvas)] px-6 text-center"
    >
      <p className="eyebrow text-[var(--danger)]">Error inesperado</p>
      <h1 className="mt-3 font-display text-[28px] font-semibold tracking-[-0.022em] text-[var(--ink)]">
        Algo se rompió en la interfaz.
      </h1>
      <p className="mt-2 max-w-[480px] text-[13.5px] text-[var(--ink-muted)]">
        El equipo no fue notificado todavía (Sentry pendiente). Mientras tanto, copia este detalle y
        mándalo a <code className="font-mono text-[var(--ink)]">hola@avoqado.io</code>:
      </p>
      <pre className="mt-4 max-w-[640px] overflow-auto rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas-sunken)] p-3 text-left font-mono text-[11px] text-[var(--ink-muted)]">
        {error.name}: {error.message}
      </pre>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 inline-flex h-9 items-center rounded-[6px] bg-[var(--accent)] px-4 text-[13px] font-medium text-[var(--canvas)] hover:bg-[var(--accent-hover)]"
      >
        Reintentar
      </button>
    </div>
  )
}
