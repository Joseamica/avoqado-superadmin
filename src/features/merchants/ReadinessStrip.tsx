import { Check, X, HelpCircle } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { ReadinessChip } from './readiness'

/**
 * Tira de readiness del Overview. Estado "ok" = superficie elevada gris (nunca
 * blanco — sigue el patrón de SetupIcons). "missing" = tenue con tooltip de copy.
 */
export function ReadinessStrip({ items }: { items: ReadinessChip[] }) {
  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label="Completitud de la cuenta">
      {items.map((c) => (
        <span
          key={c.key}
          role="listitem"
          title={c.hint}
          aria-label={
            c.state === 'missing'
              ? `${c.label}: falta${c.hint ? `. ${c.hint}` : ''}`
              : c.state === 'ok'
                ? `${c.label}: configurado`
                : `${c.label}: desconocido`
          }
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]',
            c.state === 'ok' && 'bg-[var(--canvas-raised)] text-[var(--ink)]',
            c.state === 'missing' && 'bg-[var(--danger-faint)] text-[var(--danger)]',
            c.state === 'unknown' && 'text-[var(--ink-faint)]',
          )}
        >
          {c.state === 'ok' ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : c.state === 'missing' ? (
            <X className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
          )}
          {c.label}
        </span>
      ))}
    </div>
  )
}
