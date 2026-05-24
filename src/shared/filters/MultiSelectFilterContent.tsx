import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Checkbox } from '@/shared/ui/Checkbox'
import { cn } from '@/shared/lib/utils'
import { FilterPopoverFooter, FilterPopoverHeader } from './FilterPill'

/**
 * Contenido de un FilterPill para filtros multi-select.
 *
 * Patrón: header con título, search opcional, "Seleccionar todos" master
 * toggle (indeterminate cuando hay selección parcial), lista scrollable,
 * footer con Aplicar / Limpiar.
 *
 * Diferencia clave con un toggle directo: el cambio NO es immediate — el
 * operador edita una selección local y la confirma con Aplicar. Eso permite
 * cambiar varias casillas sin que la tabla salte entre cada click. El
 * `clear` que vive en la X del pill SÍ es immediate (caso común).
 */

export interface MultiSelectOption<V extends string> {
  value: V
  label: string
}

interface MultiSelectFilterContentProps<V extends string> {
  title: string
  options: readonly MultiSelectOption<V>[]
  /** Selección actual, controlada desde el caller. */
  selected: Set<V>
  /** Se invoca con el set nuevo al hacer "Aplicar". */
  onApply: (next: Set<V>) => void
  /** Inyectado por `FilterPill` — cierra el popover. No lo seteas a mano. */
  onClose?: () => void
  /** Habilita el input de búsqueda arriba — útil cuando hay >8 opciones. */
  searchable?: boolean
  searchPlaceholder?: string
  emptyLabel?: string
}

export function MultiSelectFilterContent<V extends string>({
  title,
  options,
  selected,
  onApply,
  onClose,
  searchable = false,
  searchPlaceholder = 'Buscar…',
  emptyLabel = 'Sin coincidencias',
}: MultiSelectFilterContentProps<V>) {
  const [local, setLocal] = useState<Set<V>>(() => new Set(selected))
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return options
    const needle = search.trim().toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(needle))
  }, [options, search])

  const toggle = (v: V) =>
    setLocal((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })

  const masterState: 'all' | 'partial' | 'none' = (() => {
    const visible = filtered.map((o) => o.value)
    if (visible.length === 0) return 'none'
    const checked = visible.filter((v) => local.has(v)).length
    if (checked === 0) return 'none'
    if (checked === visible.length) return 'all'
    return 'partial'
  })()

  const handleMasterToggle = (next: boolean | 'indeterminate') => {
    const visibleSet = new Set(filtered.map((o) => o.value))
    if (next) {
      setLocal((prev) => {
        const merged = new Set(prev)
        visibleSet.forEach((v) => merged.add(v))
        return merged
      })
    } else {
      setLocal((prev) => {
        const cleared = new Set<V>()
        prev.forEach((v) => {
          if (!visibleSet.has(v)) cleared.add(v)
        })
        return cleared
      })
    }
  }

  return (
    <div className="flex flex-col">
      <FilterPopoverHeader title={title} />

      {searchable && (
        <div className="border-b border-[var(--line)] p-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-faint)]"
              aria-hidden
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-[4px] border border-[var(--line)] bg-[var(--canvas-sunken)] pl-7 pr-2 text-[12.5px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent-line)]"
              autoFocus
            />
          </div>
        </div>
      )}

      <div className="max-h-[260px] overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-[var(--ink-faint)]">{emptyLabel}</p>
        ) : (
          <ul className="space-y-px">
            {filtered.length > 1 && (
              <>
                <li>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-[12.5px] font-medium text-[var(--ink)] hover:bg-[var(--canvas-sunken)]">
                    <Checkbox
                      checked={
                        masterState === 'all'
                          ? true
                          : masterState === 'partial'
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={handleMasterToggle}
                    />
                    <span className="flex-1">
                      {search ? 'Seleccionar visibles' : 'Seleccionar todo'}
                    </span>
                    <span className="text-[11px] text-[var(--ink-faint)]">{filtered.length}</span>
                  </label>
                </li>
                <li aria-hidden className="my-1 h-px bg-[var(--line)]" />
              </>
            )}

            {filtered.map((option) => {
              const isChecked = local.has(option.value)
              return (
                <li key={option.value}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-[12.5px] transition-colors',
                      isChecked
                        ? 'bg-[var(--canvas-sunken)] text-[var(--ink)]'
                        : 'text-[var(--ink-muted)] hover:bg-[var(--canvas-sunken)] hover:text-[var(--ink)]',
                    )}
                  >
                    <Checkbox checked={isChecked} onCheckedChange={() => toggle(option.value)} />
                    <span className="flex-1 truncate">{option.label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <FilterPopoverFooter
        onApply={() => {
          onApply(local)
          onClose?.()
        }}
        onClear={() => setLocal(new Set())}
        showClear={local.size > 0}
      />
    </div>
  )
}
