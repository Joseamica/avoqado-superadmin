import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/Popover'
import { cn } from '@/shared/lib/utils'

/**
 * Combobox del design system — el ÚNICO componente del repo para
 * dropdowns / single-selects. Aplica incluso para 2 opciones (binarios).
 *
 * Reglas no-negociables (documentadas en CLAUDE.md):
 *   1. **Trigger** explícito: borde sólido, indica claramente que abre.
 *   2. **Search ALWAYS visible** en el popover — sin búsqueda no es Combobox.
 *   3. **Scroll vertical** del list con `max-height` y `overflow-y-auto`.
 *      Nunca crece sin tope; respeta el viewport.
 *   4. **Empty state explícito** ("Sin resultados") cuando no hay match.
 *   5. **`allowCustomValue`** opcional: si el operador escribe algo que
 *      no está en la lista (típicamente un version string, slug nuevo),
 *      se acepta tal cual.
 *   6. `description` por opción cuando aporta contexto.
 *   7. `searchTokens` para términos secundarios.
 *
 * NUNCA uses `<select>` HTML nativo, ni `<option>`, ni `<optgroup>`.
 * NUNCA armes dropdowns custom con div+button. Usá esto.
 *
 * Construido sobre `cmdk` (mismo motor de búsqueda que usa la
 * `CommandPalette` del repo) + Radix Popover para posicionamiento.
 */

export interface ComboboxOption {
  value: string
  label: string
  /** Texto secundario que aparece muteado debajo del label. */
  description?: string
  /** Termino de búsqueda adicional. Si no se pasa, `${label} ${value}` es la base. */
  searchTokens?: string
  /** Pinta visualmente la opción como deshabilitada. No la quita del filtrado. */
  disabled?: boolean
}

interface ComboboxProps {
  value: string
  onChange: (next: string) => void
  options: readonly ComboboxOption[]
  /** Placeholder del trigger cuando no hay valor. */
  placeholder?: string
  /** Placeholder del search input dentro del popover. */
  searchPlaceholder?: string
  /** Texto del empty state. */
  emptyLabel?: string
  /**
   * Si `true`, el operador puede escribir un valor que NO esté en `options`
   * y se aceptará tal cual. Útil para versions, slugs, IDs futuros. La
   * confirmación se hace con Enter o con un botón "Usar '{texto}'" que
   * aparece arriba del listado.
   */
  allowCustomValue?: boolean
  className?: string
  /** Width del popover. Default 320px. */
  width?: number
  /** Inhabilita el trigger entero. */
  disabled?: boolean
  /** Render custom del trigger label cuando hay value seleccionado. Si no, busca el option matching y muestra su `label`, o el `value` raw si es custom. */
  renderTriggerValue?: (value: string) => ReactNode
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Selecciona…',
  searchPlaceholder = 'Buscar…',
  emptyLabel = 'Sin resultados',
  allowCustomValue = false,
  className,
  width = 320,
  disabled = false,
  renderTriggerValue,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Si el value seleccionado existe en options, mostramos su label.
  // Sino (caso allowCustomValue), mostramos el valor crudo.
  const selectedOption = options.find((o) => o.value === value)
  const triggerLabel = value
    ? renderTriggerValue
      ? renderTriggerValue(value)
      : (selectedOption?.label ?? value)
    : placeholder

  const trimmedQuery = query.trim()
  const queryMatchesExisting =
    !!trimmedQuery && options.some((o) => o.value.toLowerCase() === trimmedQuery.toLowerCase())
  const showCustomBanner = allowCustomValue && trimmedQuery.length > 0 && !queryMatchesExisting

  function selectAndClose(next: string) {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            'inline-flex h-10 w-full items-center justify-between gap-2 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-left text-[13px] outline-none transition-colors',
            value ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]',
            disabled
              ? 'cursor-not-allowed opacity-60'
              : 'hover:border-[var(--accent-line)] focus-visible:border-[var(--accent-line)]',
            className,
          )}
        >
          <span className="min-w-0 truncate">{triggerLabel}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0" style={{ width }}>
        <Command
          className="flex flex-col"
          // cmdk hace fuzzy matching por default. Le damos los tokens de búsqueda
          // explícitos al `CommandItem` via la prop `value` y un `keywords`
          // (no soportado nativo) — lo manejamos via filtro propio:
          filter={(value, search, keywords) => {
            const needle = search.toLowerCase()
            const haystack = `${value} ${(keywords ?? []).join(' ')}`.toLowerCase()
            return haystack.includes(needle) ? 1 : 0
          }}
        >
          <div className="flex items-center gap-2 border-b border-[var(--line)] px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]" aria-hidden />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              className="h-6 w-full bg-transparent text-[12.5px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
            />
          </div>

          {showCustomBanner && (
            <button
              type="button"
              onClick={() => selectAndClose(trimmedQuery)}
              className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--accent-faint)] px-3 py-2 text-left text-[12px] text-[var(--accent)] hover:bg-[var(--accent-faint)]/80"
            >
              <span className="text-[var(--accent)]/60">Usar</span>
              <span className="font-mono font-semibold">{trimmedQuery}</span>
            </button>
          )}

          <CommandList
            // `max-h-[260px]` mantiene el popover dentro del viewport en
            // pantallas chicas. `overflow-y-auto` agrega scroll cuando
            // hay >260px de contenido. Sin esto el popover puede crecer
            // hasta tapar todo.
            className="max-h-[260px] overflow-y-auto p-1"
          >
            <CommandEmpty className="py-6 text-center text-[12px] text-[var(--ink-faint)]">
              {emptyLabel}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = option.value === value
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label, option.searchTokens ?? '']}
                    onSelect={() => {
                      if (option.disabled) return
                      selectAndClose(option.value)
                    }}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-[4px] px-2 py-1.5 text-[12.5px] aria-selected:bg-[var(--canvas-sunken)]',
                      isSelected && 'bg-[var(--canvas-sunken)]',
                      option.disabled && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <Check
                      className={cn(
                        'mt-1 h-3 w-3 shrink-0',
                        isSelected ? 'text-[var(--accent)]' : 'invisible',
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--ink)]">{option.label}</p>
                      {option.description && (
                        <p className="mt-0.5 truncate text-[10.5px] text-[var(--ink-muted)]">
                          {option.description}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
