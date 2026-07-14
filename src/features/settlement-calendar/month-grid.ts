/**
 * Matemática de calendario, pura y sin timezone.
 *
 * Todo se opera sobre llaves `yyyy-MM-dd` y `Date.UTC(...)`. NUNCA se usa
 * `new Date('2026-07-01')` ni `new Date(y, m, d)`: ambos resuelven a medianoche
 * del timezone del BROWSER, así que en un browser al este de UTC el mes se
 * recorre un día y el grid pinta mal. Con UTC puro el resultado es idéntico en
 * cualquier máquina — y coincide con las llaves que manda el backend, que ya son
 * días locales del venue.
 */

export interface GridCell {
  date: string // yyyy-MM-dd
  inMonth: boolean
}

const key = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

/** `2026-07` → 31. Día 0 del mes siguiente = último día de este. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/**
 * Semanas lunes→domingo que cubren el mes, incluyendo los días de relleno del
 * mes anterior/siguiente para que el grid quede rectangular.
 */
export function buildMonthGrid(month: string): GridCell[][] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const dow = first.getUTCDay() // 0=Dom … 6=Sáb
  const sinceMonday = (dow + 6) % 7 // lunes = 0
  const total = daysInMonth(month)

  const cells: GridCell[] = []
  // Relleno inicial (mes anterior)
  for (let i = sinceMonday; i > 0; i--) {
    cells.push({ date: key(new Date(Date.UTC(y, m - 1, 1 - i))), inMonth: false })
  }
  // Días del mes
  for (let d = 1; d <= total; d++) {
    cells.push({ date: key(new Date(Date.UTC(y, m - 1, d))), inMonth: true })
  }
  // Relleno final hasta cerrar la última semana
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date
    const [ly, lm, ld] = last.split('-').map(Number)
    cells.push({ date: key(new Date(Date.UTC(ly, lm - 1, ld + 1))), inMonth: false })
  }

  const weeks: GridCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** `2026-07` → `2026-08` / `2026-06`. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const MONTH_NAMES = [
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

/** `2026-07` → "julio 2026". */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

/** `2026-07-15` → "15 de julio". */
export function formatDayLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${d} de ${MONTH_NAMES[m - 1]}`
}

const WEEKDAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** `2026-07-15` → "mié 15". Para la lista compacta de móvil. */
export function formatDayShort(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${WEEKDAY_NAMES[dow]} ${d}`
}

/** Día de hoy en el timezone de la plataforma, como llave `yyyy-MM-dd`. */
export function todayKey(timezone = 'America/Mexico_City'): string {
  // en-CA da directamente el formato yyyy-MM-dd.
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
}

/** Mes actual (`YYYY-MM`) en el timezone de la plataforma. */
export function currentMonth(timezone = 'America/Mexico_City'): string {
  return todayKey(timezone).slice(0, 7)
}
