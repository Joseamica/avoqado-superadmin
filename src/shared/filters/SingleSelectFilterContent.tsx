import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { FilterPopoverHeader } from './FilterPill'

/**
 * Contenido de un FilterPill para filtros single-select (radio-like).
 *
 * El cambio se aplica de inmediato — no hay footer Apply/Cancel — porque
 * con una sola opción seleccionable no hay nada que "componer". Tras
 * seleccionar, el popover se cierra solo. Equivalente al patrón de
 * "presets" en Linear / Stripe.
 */

export interface SingleSelectOption<V extends string> {
  value: V
  label: string
  description?: string
}

interface SingleSelectFilterContentProps<V extends string> {
  title: string
  options: readonly SingleSelectOption<V>[]
  selected: V
  onChange: (next: V) => void
  /** Inyectado por `FilterPill` — cierra el popover. */
  onClose?: () => void
}

export function SingleSelectFilterContent<V extends string>({
  title,
  options,
  selected,
  onChange,
  onClose,
}: SingleSelectFilterContentProps<V>) {
  return (
    <div className="flex flex-col">
      <FilterPopoverHeader title={title} />
      <ul className="space-y-px p-1" role="radiogroup">
        {options.map((option) => {
          const isActive = option.value === selected
          return (
            <li key={option.value}>
              <button
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => {
                  onChange(option.value)
                  onClose?.()
                }}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-[4px] px-2 py-2 text-left transition-colors',
                  isActive
                    ? 'bg-[var(--canvas-sunken)] text-[var(--ink)]'
                    : 'text-[var(--ink-muted)] hover:bg-[var(--canvas-sunken)] hover:text-[var(--ink)]',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                    isActive
                      ? 'border-[var(--accent)] bg-[var(--accent)]'
                      : 'border-[var(--line-strong)]',
                  )}
                  aria-hidden
                >
                  {isActive && (
                    <Check className="h-2.5 w-2.5 text-[var(--canvas)]" strokeWidth={3} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium">{option.label}</p>
                  {option.description && (
                    <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
                      {option.description}
                    </p>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
