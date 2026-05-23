import { DateTime } from 'luxon'

/**
 * Política de timezone para el superadmin:
 *  - El backend siempre transmite ISO 8601 con sufijo Z (UTC).
 *  - El default de display es America/Mexico_City (operación primaria).
 *  - Cuando la fila pertenece a un venue específico que conocemos, se pasa
 *    venue.timezone como segundo argumento para mostrar en la hora del venue.
 *  - El consumidor decide explícitamente: nada se infiere del browser.
 */

export const DEFAULT_TIMEZONE = 'America/Mexico_City'

type DateInput = string | Date | number | null | undefined

function toDateTime(input: DateInput, timezone: string): DateTime | null {
  if (input === null || input === undefined || input === '') return null

  let dt: DateTime
  if (input instanceof Date) {
    dt = DateTime.fromJSDate(input, { zone: 'utc' })
  } else if (typeof input === 'number') {
    dt = DateTime.fromMillis(input, { zone: 'utc' })
  } else {
    dt = DateTime.fromISO(input, { zone: 'utc' })
  }

  if (!dt.isValid) return null
  return dt.setZone(timezone)
}

/** "20 oct 2025, 14:30" */
export function formatDateTime(input: DateInput, timezone: string = DEFAULT_TIMEZONE): string {
  const dt = toDateTime(input, timezone)
  return dt ? dt.toLocaleString(DateTime.DATETIME_MED) : '—'
}

/** "14:30" */
export function formatTime(input: DateInput, timezone: string = DEFAULT_TIMEZONE): string {
  const dt = toDateTime(input, timezone)
  return dt ? dt.toLocaleString(DateTime.TIME_24_SIMPLE) : '—'
}

/** "20 oct 2025" */
export function formatDate(input: DateInput, timezone: string = DEFAULT_TIMEZONE): string {
  const dt = toDateTime(input, timezone)
  return dt ? dt.toLocaleString(DateTime.DATE_MED) : '—'
}

/** "2025-10-20" */
export function formatDateISO(input: DateInput, timezone: string = DEFAULT_TIMEZONE): string {
  const dt = toDateTime(input, timezone)
  return dt?.toISODate() ?? '—'
}

/** "hace 3 horas" / "in 2 days" */
export function formatRelative(input: DateInput, timezone: string = DEFAULT_TIMEZONE): string {
  const dt = toDateTime(input, timezone)
  return dt?.toRelative() ?? '—'
}

/**
 * Abreviatura corta del timezone para mostrar en headers de tabla.
 * @example "CST" | "EDT" | "UTC"
 */
export function timezoneShort(timezone: string = DEFAULT_TIMEZONE): string {
  const now = DateTime.now().setZone(timezone)
  return now.offsetNameShort ?? timezone
}
