import { formatMoney } from '@/shared/lib/money'
import { cn } from '@/shared/lib/utils'
import { formatDayShort, todayKey } from './month-grid'
import type { CalendarDay } from './types'

interface Props {
  days: CalendarDay[]
  selected: string | null
  onSelect: (date: string) => void
}

/**
 * La vista de móvil. Un grid de 7 columnas no cabe en 390px: cada celda queda de
 * ~48px y el monto se trunca a "$…", que es exactamente la información por la que
 * existe la pantalla. Así que en móvil no encogemos el calendario — lo cambiamos
 * por una lista de los días que SÍ tienen depósito, donde el monto se lee entero.
 * (El grid vuelve a partir de `sm`, donde ya hay ancho para él.)
 */
export function DayList({ days, selected, onSelect }: Props) {
  const today = todayKey()

  return (
    <ul className="flex flex-col gap-1.5">
      {days.map((day) => {
        const isToday = day.date === today
        const isSelected = day.date === selected

        return (
          <li key={day.date}>
            <button
              type="button"
              onClick={() => onSelect(day.date)}
              aria-pressed={isSelected}
              className={cn(
                // h-11 (44px): CTA-grade touch target — es el control principal de la vista móvil.
                'flex h-11 w-full items-center justify-between gap-3 rounded-[6px] border px-3 text-left transition-colors',
                isSelected
                  ? 'border-[var(--accent-line)] bg-[var(--canvas-raised)]'
                  : 'border-[var(--line)] hover:bg-[var(--canvas-raised)]',
              )}
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span
                  className={cn(
                    'tabular text-[13px]',
                    isToday || isSelected
                      ? 'font-semibold text-[var(--ink)]'
                      : 'text-[var(--ink-muted)]',
                  )}
                >
                  {formatDayShort(day.date)}
                </span>
                {isToday && <span className="label text-[var(--success)]">hoy</span>}
                <span className="label truncate">
                  {day.venues.length} {day.venues.length === 1 ? 'negocio' : 'negocios'}
                </span>
              </span>
              <span className="tabular shrink-0 text-[14px] font-semibold text-[var(--ink)]">
                {formatMoney(day.net)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
