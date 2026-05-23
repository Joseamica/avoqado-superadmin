import { AlertTriangle, RefreshCw } from 'lucide-react'
import { inspectApiError } from '@/shared/lib/api-error'
import { cn } from '@/shared/lib/utils'

interface QueryErrorProps {
  error: unknown
  /**
   * Verbo en infinitivo que describe qué se estaba haciendo cuando falló
   * (ej. "cargar el resumen", "exportar el CSV"). Se incluye en el mensaje
   * de network error.
   */
  context?: string
  /** Si pasas onRetry, sale un botón "Reintentar". */
  onRetry?: () => void
  /** Marca true cuando la query ya esté refetcheando para deshabilitar el botón. */
  isRetrying?: boolean
  className?: string
}

/**
 * UI consistente para errores de TanStack Query (u otros). Inspecciona el
 * error, muestra un mensaje categorizado, y opcionalmente expande detalle
 * técnico + botón de retry. Reemplaza el patrón "No pudimos ..." generic.
 */
export function QueryError({ error, context, onRetry, isRetrying, className }: QueryErrorProps) {
  const info = inspectApiError(error, context)
  const showServerDetail = info.serverMessage && info.serverMessage !== info.description

  return (
    <div
      role="alert"
      className={cn(
        'rounded-[6px] border border-[var(--danger)]/40 bg-[var(--danger-faint)] px-3.5 py-3 text-[13px] text-[var(--danger)]',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{info.title}</p>
          <p className="mt-0.5 text-[var(--ink-muted)]">{info.description}</p>

          {showServerDetail && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11.5px] text-[var(--ink-faint)] hover:text-[var(--ink-muted)]">
                Detalle técnico
              </summary>
              <pre className="mt-1.5 overflow-auto rounded-[4px] border border-[var(--line)] bg-[var(--canvas)] p-2 font-mono text-[11px] leading-relaxed text-[var(--ink-muted)]">
                {info.serverMessage}
                {info.status && `\nHTTP ${info.status}`}
              </pre>
            </details>
          )}

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-[var(--danger)]/30 bg-transparent px-2.5 text-[12px] font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger-faint)]/50 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', isRetrying && 'animate-spin')} aria-hidden />
              {isRetrying ? 'Reintentando…' : 'Reintentar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
