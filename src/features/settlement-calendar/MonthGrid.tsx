import { formatCompactMoney, formatMoney } from '@/shared/lib/money'
import { cn } from '@/shared/lib/utils'
import { buildMonthGrid, formatDayLabel, todayKey } from './month-grid'
import type { CalendarDay } from './types'

interface Props {
  month: string
  days: CalendarDay[]
  selected: string | null
  onSelect: (date: string) => void
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function MonthGrid({ month, days, selected, onSelect }: Props) {
  const weeks = buildMonthGrid(month)
  const byDate = new Map(days.map((d) => [d.date, d]))
  const today = todayKey()

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="label px-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {weeks.flat().map((cell) => {
          const day = byDate.get(cell.date)
          const isToday = cell.date === today
          const isSelected = cell.date === selected
          const hasMoney = !!day && day.net > 0

          return (
            <button
              key={cell.date}
              type="button"
              // Un día sin depósitos no tiene desglose que abrir: no es clickeable
              // y sale del orden de tabulación, en vez de ofrecer un click muerto.
              disabled={!hasMoney}
              onClick={() => hasMoney && onSelect(cell.date)}
              // El lector de pantalla debe oír "15 de julio: $22,400.00 de 3
              // negocios", no la llave cruda "2026-07-15" ni el monto abreviado.
              aria-label={
                hasMoney
                  ? `${formatDayLabel(cell.date)}: ${formatMoney(day.net)} de ${day.venues.length} ${
                      day.venues.length === 1 ? 'negocio' : 'negocios'
                    }`
                  : `${formatDayLabel(cell.date)}: sin depósitos`
              }
              aria-pressed={isSelected}
              className={cn(
                'flex min-h-[76px] flex-col items-start rounded-[6px] border p-2 text-left transition-colors',
                cell.inMonth ? 'border-[var(--line)]' : 'border-transparent opacity-40',
                hasMoney && 'hover:border-[var(--line-strong)] hover:bg-[var(--canvas-raised)]',
                !hasMoney && 'cursor-default',
                isSelected && 'border-[var(--accent-line)] bg-[var(--canvas-raised)]',
              )}
            >
              <span
                className={cn(
                  'label tabular',
                  isToday && 'font-semibold text-[var(--ink)]',
                  isSelected && 'text-[var(--ink)]',
                )}
              >
                {Number(cell.date.slice(8))}
                {isToday && ' · hoy'}
              </span>

              {hasMoney && (
                <div className="mt-auto w-full">
                  <div className="tabular truncate text-[13px] font-semibold text-[var(--ink)]">
                    {formatCompactMoney(day.net)}
                  </div>
                  <div className="label truncate">
                    {day.venues.length} {day.venues.length === 1 ? 'negocio' : 'negocios'}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
