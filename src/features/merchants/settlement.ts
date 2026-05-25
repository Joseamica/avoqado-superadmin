import type { SettlementDayType } from './types'

/**
 * Proyecta la fecha de depósito (estimado). Opera en espacio de fecha-civil
 * usando componentes UTC para ser determinista: el caller pasa un `from` cuyo
 * día UTC = el día civil deseado (ver `mxCivilToday`). `holidays` = set de
 * 'YYYY-MM-DD' (lo que devuelve /holidays).
 */
export function projectSettlementDate(
  from: Date,
  days: number,
  dayType: SettlementDayType,
  holidays: Set<string>,
): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  if (dayType === 'CALENDAR_DAYS') {
    d.setUTCDate(d.getUTCDate() + days)
    return d
  }
  let counted = 0
  while (counted < days) {
    d.setUTCDate(d.getUTCDate() + 1)
    const dow = d.getUTCDay() // 0 dom, 6 sáb
    const isoDay = d.toISOString().slice(0, 10)
    if (dow !== 0 && dow !== 6 && !holidays.has(isoDay)) counted++
  }
  return d
}

/** Día civil de hoy en America/Mexico_City, como Date UTC-midnight (para `from`). */
export function mxCivilToday(now: Date = new Date()): Date {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [y, m, dd] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, dd))
}

/** Formatea un Date UTC-midnight como fecha civil es-MX (sin corrimiento de TZ). */
export function formatCivilDate(d: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}
