/**
 * DateRangePicker — dual-calendar date range selector estilo booking de aerolínea.
 *
 * Dos meses lado a lado, click en fecha inicio → click en fecha fin → rango
 * visual. Conversión timezone-aware (display en local, retorna UTC ISO 8601).
 *
 * Uso dentro de un FilterPill:
 * ```tsx
 * <FilterPill label="Fecha" popoverClassName="w-auto" ...>
 *   <DateRangePicker value={range} onApply={setRange} presets={PRESETS} showTime />
 * </FilterPill>
 * ```
 *
 * Uso standalone:
 * ```tsx
 * <DateRangePicker value={range} onApply={handleRange} />
 * ```
 *
 * @module shared/ui/DateRangePicker
 */

import { useCallback, useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DEFAULT_TIMEZONE } from '@/shared/lib/datetime'
import { cn } from '@/shared/lib/utils'
import { IconButton } from '@/shared/ui/IconButton'
import { buttonVariants } from '@/shared/ui/button-variants'

/* ─── Public types ─── */

export interface DateRangeValue {
  /** ISO 8601 UTC start time, ej. "2026-05-26T13:00:00.000Z" */
  startTime?: string
  /** ISO 8601 UTC end time */
  endTime?: string
}

export interface DateRangePreset {
  label: string
  /** Horas hacia atrás desde ahora. */
  hours: number
}

/* ─── Internal helpers ─── */

const WEEKDAY_LABELS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']

const MONTH_NAMES = [
  '',
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

interface CalendarDay {
  date: DateTime
  isCurrentMonth: boolean
}

function getCalendarDays(year: number, month: number): CalendarDay[] {
  const first = DateTime.local(year, month, 1)
  // Luxon weekday: 1 = Monday → alinea con la grilla que empieza en lunes.
  const offset = first.weekday - 1
  const start = first.minus({ days: offset })
  const days: CalendarDay[] = []
  for (let i = 0; i < 42; i++) {
    const d = start.plus({ days: i })
    days.push({ date: d, isCurrentMonth: d.month === month })
  }
  return days
}

function sameDay(a: DateTime | null, b: DateTime | null): boolean {
  if (!a || !b) return false
  return a.hasSame(b, 'day')
}

function dayInRange(date: DateTime, start: DateTime | null, end: DateTime | null): boolean {
  if (!start || !end) return false
  const d = date.startOf('day').toMillis()
  return d > start.startOf('day').toMillis() && d < end.startOf('day').toMillis()
}

function formatHeaderDate(dt: DateTime | null): string {
  if (!dt) return ''
  return `${dt.day} / ${dt.month} / ${dt.year}`
}

/**
 * Label legible para un FilterPill cuando hay un range activo.
 * Importado desde los callers que muestran la pill del date range.
 */
export function formatDateRangeLabel(
  range: DateRangeValue,
  timezone: string = DEFAULT_TIMEZONE,
): string | null {
  if (!range.startTime && !range.endTime) return null
  const now = DateTime.now().setZone(timezone)

  // Preset "desde hace N horas" (startTime sin endTime).
  if (range.startTime && !range.endTime) {
    const start = DateTime.fromISO(range.startTime, { zone: 'utc' }).setZone(timezone)
    const diffH = now.diff(start, 'hours').hours
    if (diffH <= 1.1) return 'Última hora'
    if (diffH <= 6.5) return `Últimas ${Math.round(diffH)}h`
    if (diffH <= 25) return 'Últimas 24h'
    if (diffH <= 75) return 'Últimos 3 días'
    if (diffH <= 170) return 'Última semana'
  }

  // Range explícito — fechas compactas.
  const parts: string[] = []
  if (range.startTime) {
    const s = DateTime.fromISO(range.startTime, { zone: 'utc' }).setZone(timezone)
    parts.push(s.toFormat('dd/MM HH:mm'))
  }
  if (range.endTime) {
    const e = DateTime.fromISO(range.endTime, { zone: 'utc' }).setZone(timezone)
    parts.push(e.toFormat('dd/MM HH:mm'))
  }
  return parts.join(' → ')
}

/* ─── MonthCalendar (sub-component) ─── */

interface MonthCalendarProps {
  month: DateTime
  today: DateTime
  /** Fecha mínima seleccionable (inclusive). Días anteriores se deshabilitan. */
  minDate: DateTime | null
  rangeStart: DateTime | null
  rangeEnd: DateTime | null
  startDate: DateTime | null
  endDate: DateTime | null
  onDayClick: (date: DateTime) => void
  onDayHover: (date: DateTime | null) => void
  navSlot: 'left' | 'right'
  onBack: () => void
  onForward: () => void
  canForward: boolean
}

function MonthCalendar({
  month,
  today,
  minDate,
  rangeStart,
  rangeEnd,
  startDate,
  endDate,
  onDayClick,
  onDayHover,
  navSlot,
  onBack,
  onForward,
  canForward,
}: MonthCalendarProps) {
  const days = useMemo(() => getCalendarDays(month.year, month.month), [month.year, month.month])

  return (
    <div className="min-w-[252px] flex-1 px-3 pb-2 pt-3">
      {/* Month header + navigation */}
      <div className="mb-2 flex items-center justify-between">
        {navSlot === 'left' ? (
          <IconButton size="sm" aria-label="Mes anterior" onClick={onBack}>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
        ) : (
          <span className="w-7" />
        )}
        <span className="select-none text-[13px] font-semibold text-[var(--ink)]">
          {MONTH_NAMES[month.month]} {month.year}
        </span>
        {navSlot === 'right' ? (
          <IconButton
            size="sm"
            aria-label="Mes siguiente"
            onClick={onForward}
            disabled={!canForward}
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
        ) : (
          <span className="w-7" />
        )}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((wd) => (
          <div
            key={wd}
            className="flex h-8 items-center justify-center text-[11px] font-medium text-[var(--ink-faint)]"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7" onMouseLeave={() => onDayHover(null)}>
        {days.map((cell, i) => {
          const d = cell.date.startOf('day')
          const isToday = sameDay(d, today)
          const isStart = sameDay(d, startDate)
          const isEnd = sameDay(d, endDate)
          const isSelected = isStart || isEnd
          const inRange = dayInRange(d, rangeStart, rangeEnd)
          const isFuture = d > today
          const isTooOld = !!(minDate && d < minDate)
          const isDisabled = isFuture || isTooOld

          // Range band shape: start gets left-rounding, end gets right-rounding,
          // middle cells are flat para crear una banda continua.
          const hasRange = !!(rangeStart && rangeEnd)
          const isRangeStart = isStart && hasRange
          const isRangeEnd = isEnd && hasRange

          return (
            <button
              key={i}
              type="button"
              tabIndex={cell.isCurrentMonth && !isDisabled ? 0 : -1}
              disabled={isDisabled}
              onClick={() => cell.isCurrentMonth && !isDisabled && onDayClick(d)}
              onMouseEnter={() => cell.isCurrentMonth && !isDisabled && onDayHover(d)}
              className={cn(
                'flex h-9 items-center justify-center text-[13px] tabular-nums transition-colors',

                // Outside current month
                !cell.isCurrentMonth && 'pointer-events-none text-[var(--ink-faint)]/30',
                // In-range highlight persists across month boundaries
                !cell.isCurrentMonth &&
                  inRange &&
                  'bg-[var(--accent-faint)] !text-[var(--ink-faint)]/30',

                // Normal day (current month, not selected, not in range, not disabled)
                cell.isCurrentMonth &&
                  !isSelected &&
                  !inRange &&
                  !isDisabled &&
                  'text-[var(--ink)] hover:bg-[var(--canvas-raised)]',

                // Today indicator
                isToday && !isSelected && 'font-bold',

                // Range band (between start and end)
                inRange && cell.isCurrentMonth && !isSelected && 'bg-[var(--accent-faint)]',

                // Selected endpoints — solid inverted bg
                isSelected && 'bg-[var(--ink)] font-semibold text-[var(--canvas)]',

                // Rounding: range start = left-rounded, range end = right-rounded
                isRangeStart && 'rounded-l-[6px]',
                isRangeEnd && 'rounded-r-[6px]',
                isSelected && !hasRange && 'rounded-[6px]',

                // Disabled dates (future or too old)
                isDisabled &&
                  cell.isCurrentMonth &&
                  'text-[var(--ink-faint)]/30 cursor-not-allowed',
              )}
              aria-label={cell.date.toFormat('d MMMM yyyy', { locale: 'es' })}
              aria-selected={isSelected || undefined}
              aria-current={isToday ? 'date' : undefined}
            >
              {cell.date.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ─── DateRangePicker (main export) ─── */

interface DateRangePickerProps {
  value: DateRangeValue
  onApply: (range: DateRangeValue) => void
  /** Injected by FilterPill — cierra el popover. */
  onClose?: () => void
  /** Timezone para display. Default: America/Mexico_City. */
  timezone?: string
  /** Presets rápidos (ej. "1h", "24h"). Se aplican al click sin pasar por el calendar. */
  presets?: DateRangePreset[]
  /** Mostrar inputs de hora debajo del calendario. Default: false. */
  showTime?: boolean
  /**
   * Días máximos hacia atrás que se pueden seleccionar (desde hoy).
   * Días anteriores a `today - maxDaysBack` se deshabilitan en el calendario.
   * Ej. `30` = máximo 30 días atrás (límite de retención de Render).
   */
  maxDaysBack?: number
  /** Texto corto que explica el límite de `maxDaysBack`, mostrado bajo el calendar. */
  maxDaysBackHint?: string
  className?: string
}

export function DateRangePicker({
  value,
  onApply,
  onClose,
  timezone = DEFAULT_TIMEZONE,
  presets,
  showTime = false,
  maxDaysBack,
  maxDaysBackHint,
  className,
}: DateRangePickerProps) {
  const parseUtc = useCallback(
    (iso: string | undefined): DateTime | null => {
      if (!iso) return null
      const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone)
      return dt.isValid ? dt : null
    },
    [timezone],
  )

  const [startDate, setStartDate] = useState<DateTime | null>(() => parseUtc(value.startTime))
  const [endDate, setEndDate] = useState<DateTime | null>(() => parseUtc(value.endTime))
  const [hoverDate, setHoverDate] = useState<DateTime | null>(null)
  const [startTimeStr, setStartTimeStr] = useState(
    () => parseUtc(value.startTime)?.toFormat('HH:mm') ?? '',
  )
  const [endTimeStr, setEndTimeStr] = useState(
    () => parseUtc(value.endTime)?.toFormat('HH:mm') ?? '',
  )

  // El mes izquierdo del dual calendar. El derecho es +1.
  const [leftMonth, setLeftMonth] = useState<DateTime>(() => {
    const base = parseUtc(value.startTime) ?? DateTime.now().setZone(timezone)
    return base.startOf('month').minus({ months: 1 })
  })
  const rightMonth = leftMonth.plus({ months: 1 })
  const today = useMemo(() => DateTime.now().setZone(timezone).startOf('day'), [timezone])
  // +1 día de buffer: Render (y APIs similares) verifican contra el instante
  // exacto, no start-of-day. Si maxDaysBack=30 y hoy es May 26 a las 14:00 UTC,
  // el límite real es April 26 a las 14:00 UTC — pero start-of-day en CDMX
  // (April 26 06:00 UTC) cae antes de ese corte. El +1 evita ese edge case.
  const minDate = useMemo(
    () => (maxDaysBack ? today.minus({ days: maxDaysBack - 1 }) : null),
    [today, maxDaysBack],
  )

  // Navigation — no dejar avanzar más allá del mes actual + 1.
  const canForward =
    rightMonth.plus({ months: 1 }).startOf('month') <= today.plus({ months: 1 }).startOf('month')
  const goBack = () => setLeftMonth((m) => m.minus({ months: 1 }))
  const goForward = () => canForward && setLeftMonth((m) => m.plus({ months: 1 }))

  // Selection logic: primer click = start, segundo = end. Si end < start, swap.
  const handleDayClick = (date: DateTime) => {
    if (!startDate || endDate) {
      // Nuevo rango
      setStartDate(date)
      setEndDate(null)
    } else if (sameDay(date, startDate)) {
      // Click en el mismo día — deselecciona.
      setStartDate(null)
    } else if (date < startDate) {
      // Antes del start → swap.
      setEndDate(startDate)
      setStartDate(date)
    } else {
      setEndDate(date)
    }
  }

  // Visual range: usa hover como end provisional si no hay endDate todavía.
  const rangeStart = startDate
  const rangeEnd =
    endDate ??
    (startDate && hoverDate && !sameDay(hoverDate, startDate) && hoverDate > startDate
      ? hoverDate
      : null)

  // Preset — aplica directo sin pasar por el calendar.
  const handlePreset = (hours: number) => {
    const start = DateTime.now().setZone(timezone).minus({ hours })
    onApply({ startTime: start.toUTC().toISO() ?? undefined, endTime: undefined })
    onClose?.()
  }

  // Apply — convierte local → UTC.
  const handleApply = () => {
    const range: DateRangeValue = {}
    if (startDate) {
      let dt = startDate.startOf('day')
      if (showTime && startTimeStr) {
        const [h, m] = startTimeStr.split(':').map(Number)
        dt = startDate.set({ hour: h || 0, minute: m || 0, second: 0, millisecond: 0 })
      }
      range.startTime = dt.toUTC().toISO() ?? undefined
    }
    if (endDate) {
      let dt = endDate.set({ hour: 23, minute: 59, second: 59, millisecond: 999 })
      if (showTime && endTimeStr) {
        const [h, m] = endTimeStr.split(':').map(Number)
        dt = endDate.set({ hour: h || 0, minute: m || 0, second: 59, millisecond: 999 })
      }
      range.endTime = dt.toUTC().toISO() ?? undefined
    }
    onApply(range)
    onClose?.()
  }

  const handleClear = () => {
    setStartDate(null)
    setEndDate(null)
    setHoverDate(null)
    setStartTimeStr('')
    setEndTimeStr('')
    onApply({})
    onClose?.()
  }

  return (
    <div className={cn('w-fit', className)} data-testid="date-range-picker">
      {/* ── Range header ── */}
      <div className="flex items-center justify-center gap-3 border-b border-[var(--line)] px-4 py-3">
        <div
          className={cn(
            'tabular rounded-[6px] border px-3 py-1.5 text-center text-[13px] font-medium transition-colors',
            startDate
              ? 'border-[var(--line-strong)] bg-[var(--canvas-raised)] text-[var(--ink)]'
              : 'border-[var(--line)] text-[var(--ink-faint)]',
          )}
        >
          {startDate ? formatHeaderDate(startDate) : 'Fecha inicio'}
        </div>
        <span className="text-[13px] text-[var(--ink-faint)]" aria-hidden>
          –
        </span>
        <div
          className={cn(
            'tabular rounded-[6px] border px-3 py-1.5 text-center text-[13px] font-medium transition-colors',
            endDate
              ? 'border-[var(--line-strong)] bg-[var(--canvas-raised)] text-[var(--ink)]'
              : 'border-[var(--line)] text-[var(--ink-faint)]',
          )}
        >
          {endDate ? formatHeaderDate(endDate) : 'Fecha fin'}
        </div>
      </div>

      {/* ── Presets ── */}
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-[var(--line)] px-4 py-2.5">
          {presets.map((p) => (
            <button
              key={p.hours}
              type="button"
              onClick={() => handlePreset(p.hours)}
              className="h-7 rounded-full border border-[var(--line-strong)] px-2.5 text-[11px] font-medium text-[var(--ink-muted)] transition-colors hover:border-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Dual calendar ── */}
      <div className="flex flex-col sm:flex-row">
        <MonthCalendar
          month={leftMonth}
          today={today}
          minDate={minDate}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          startDate={startDate}
          endDate={endDate}
          onDayClick={handleDayClick}
          onDayHover={setHoverDate}
          navSlot="left"
          onBack={goBack}
          onForward={goForward}
          canForward={canForward}
        />
        <div className="hidden w-px self-stretch bg-[var(--line)] sm:block" aria-hidden />
        <MonthCalendar
          month={rightMonth}
          today={today}
          minDate={minDate}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          startDate={startDate}
          endDate={endDate}
          onDayClick={handleDayClick}
          onDayHover={setHoverDate}
          navSlot="right"
          onBack={goBack}
          onForward={goForward}
          canForward={canForward}
        />
      </div>

      {/* ── Retention hint ── */}
      {maxDaysBackHint && (
        <p className="border-t border-[var(--line)] px-4 py-2 text-[11px] text-[var(--ink-faint)]">
          {maxDaysBackHint}
        </p>
      )}

      {/* ── Time inputs (optional) ── */}
      {showTime && (
        <div className="flex gap-4 border-t border-[var(--line)] px-4 py-3">
          <fieldset className="flex flex-1 flex-col gap-1">
            <legend className="label">Hora inicio</legend>
            <input
              type="time"
              value={startTimeStr}
              onChange={(e) => setStartTimeStr(e.target.value)}
              className="h-8 rounded-[5px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2 text-[12px] tabular-nums text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </fieldset>
          <fieldset className="flex flex-1 flex-col gap-1">
            <legend className="label">Hora fin</legend>
            <input
              type="time"
              value={endTimeStr}
              onChange={(e) => setEndTimeStr(e.target.value)}
              className="h-8 rounded-[5px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2 text-[12px] tabular-nums text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </fieldset>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center gap-2 border-t border-[var(--line)] p-2">
        <button
          type="button"
          onClick={handleClear}
          className="h-8 flex-1 rounded-[4px] px-3 text-[12px] font-medium text-[var(--ink-muted)] hover:bg-[var(--canvas-sunken)] hover:text-[var(--ink)]"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={handleApply}
          className={buttonVariants({ size: 'sm', className: 'h-8 flex-1' })}
        >
          Aplicar
        </button>
      </div>
    </div>
  )
}
