import { ChevronDown, CirclePlus, CircleX } from 'lucide-react'
import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from 'react'
import { buttonVariants } from '@/shared/ui/button-variants'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/Popover'
import { cn } from '@/shared/lib/utils'

/**
 * Stripe-style filter pill.
 *
 * - **Inactivo**: pill con borde punteado y texto muted, `+ Etiqueta`.
 *   Communica "agregar filtro" sin gritar.
 * - **Activo**: pill sólido (fondo inverso al canvas), `[×] Etiqueta | Valor ▾`.
 *   La X limpia el filtro sin abrir el popover; el resto del pill lo abre
 *   para editar.
 *
 * El popover recibe el `onClose` cloned hacia el children — así el contenido
 * del filtro puede cerrarse a sí mismo después de aplicar/cancelar sin tener
 * que cablear refs.
 */

interface FilterPillProps {
  /** Etiqueta de la dimensión, ej. "Estado", "KYC", "Origen". */
  label: string
  /** Valor visible cuando hay activos. Para multi-select, lo formatea el caller (ej. "Activo, Pausado +1"). */
  activeLabel?: string | null
  /** Cuenta de valores seleccionados. Si > 0 y no hay `activeLabel`, se muestra como número. */
  activeCount?: number
  /** Limpia el filtro de un solo click sobre la X. Pásalo siempre que tenga sentido limpiar. */
  onClear?: () => void
  /** Alineación del popover relativo al trigger. */
  align?: 'start' | 'center' | 'end'
  /**
   * Override del className del PopoverContent. Por default `'w-[280px]'`.
   * Útil para contenido más ancho como `DateRangePicker` (`'w-auto'`).
   */
  popoverClassName?: string
  /** Contenido del popover. Si es un React element acepta una prop `onClose: () => void` que el pill inyecta. */
  children: ReactNode
  className?: string
}

export function FilterPill({
  label,
  activeLabel,
  activeCount,
  onClear,
  align = 'start',
  popoverClassName,
  children,
  className,
}: FilterPillProps) {
  const [open, setOpen] = useState(false)

  const display =
    activeLabel || (typeof activeCount === 'number' && activeCount > 0 ? String(activeCount) : null)
  const hasValue = !!display

  // El pill expone su propio `onClose` al children — útil para que el filter
  // content cierre el popover al hacer "Aplicar" o al apretar Enter en search.
  const childrenWithClose = isValidElement(children)
    ? cloneElement(children as ReactElement<{ onClose?: () => void }>, {
        onClose: () => setOpen(false),
      })
    : children

  return (
    <div className={cn('shrink-0', className)} data-filter-pill data-active={hasValue}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors',
              !hasValue &&
                'border border-dashed border-[var(--line-strong)] text-[var(--ink-muted)] hover:border-[var(--ink-muted)] hover:text-[var(--ink)]',
              // Activo: usamos el ink como background para "invertir" el chip
              // dentro del dark theme — es más legible que mantenerlo en accent
              // (el accent se reserva para CTAs, no estados).
              hasValue &&
                'border border-transparent bg-[var(--ink)] pl-1.5 pr-2 text-[var(--canvas)] hover:bg-[var(--ink)]/90',
            )}
          >
            {hasValue ? (
              <>
                {onClear && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      onClear()
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation()
                        e.preventDefault()
                        onClear()
                      }
                    }}
                    aria-label={`Limpiar filtro de ${label.toLowerCase()}`}
                    className="-ml-0.5 inline-flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-full text-[var(--canvas)]/70 hover:text-[var(--canvas)]"
                  >
                    <CircleX className="h-3.5 w-3.5" aria-hidden />
                  </span>
                )}
                <span className="text-[var(--canvas)]/70">{label}</span>
                <span className="text-[var(--canvas)]/30" aria-hidden>
                  |
                </span>
                <span className="max-w-[160px] truncate font-semibold">{display}</span>
                <ChevronDown className="h-3 w-3 text-[var(--canvas)]/60" aria-hidden />
              </>
            ) : (
              <>
                <CirclePlus className="h-3 w-3 text-[var(--ink-faint)]" aria-hidden />
                <span>{label}</span>
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align={align} className={cn('p-0', popoverClassName ?? 'w-[280px]')}>
          {childrenWithClose}
        </PopoverContent>
      </Popover>
    </div>
  )
}

/* --- Sub-componentes para construir el contenido del popover --- */

interface FilterPopoverHeaderProps {
  title: string
  /** Acción a la derecha del título — típicamente "Limpiar todo" cuando hay valores. */
  action?: ReactNode
}

export function FilterPopoverHeader({ title, action }: FilterPopoverHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
      <p className="eyebrow">{title}</p>
      {action && <div>{action}</div>}
    </header>
  )
}

interface FilterPopoverFooterProps {
  onApply: () => void
  onClear?: () => void
  applyLabel?: string
  clearLabel?: string
  showClear?: boolean
}

export function FilterPopoverFooter({
  onApply,
  onClear,
  applyLabel = 'Aplicar',
  clearLabel = 'Limpiar',
  showClear = true,
}: FilterPopoverFooterProps) {
  return (
    <footer className="flex items-center gap-2 border-t border-[var(--line)] p-2">
      {showClear && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="h-8 flex-1 rounded-[4px] px-3 text-[12px] font-medium text-[var(--ink-muted)] hover:bg-[var(--canvas-sunken)] hover:text-[var(--ink)]"
        >
          {clearLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onApply}
        className={buttonVariants({ size: 'sm', className: 'h-8 flex-1' })}
      >
        {applyLabel}
      </button>
    </footer>
  )
}
