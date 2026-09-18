import { DateTime } from 'luxon'

/**
 * La vigencia de una campaña se captura y se muestra en hora de la Ciudad de
 * México, y viaja en UTC.
 *
 * 🔴 El desplazamiento está FIJO en -06:00 en vez de resolverse contra la base de
 * zonas horarias, y es a propósito: México dejó el horario de verano en 2022, la
 * vigencia siempre es futura, y si la regla de verano volviera, resolverla movería
 * la vigencia de las campañas ya capturadas una hora sin que nadie lo pida. Si un
 * día vuelve el horario de verano, esto se cambia aquí — en un solo sitio — y a
 * propósito.
 */

/** -06:00 los 365 días del año (America/Mexico_City desde 2022). */
const OFFSET_CDMX = '-06:00'
const ZONA_FIJA = 'UTC-6'

const LOCAL_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/

/**
 * `'2026-09-20T00:00'` → `'2026-09-20T00:00:00-06:00'`.
 *
 * Devuelve `null` cuando el valor está vacío o mal formado, porque el input
 * `datetime-local` entrega cadena vacía mientras nadie lo llena y una fecha
 * inventada ahí sería una vigencia que nadie eligió.
 */
export function mexicoLocalToIso(local: string | null | undefined): string | null {
  if (!local) return null
  const m = LOCAL_RE.exec(local.trim())
  if (!m) return null
  const [, fecha, hhmm, ss] = m
  const iso = `${fecha}T${hhmm}${ss ?? ':00'}${OFFSET_CDMX}`
  return DateTime.fromISO(iso).isValid ? iso : null
}

/**
 * `'2026-09-20T06:00:00.000Z'` → `'2026-09-20T00:00'`, listo para un
 * `<input type="datetime-local">`. Sin fecha devuelve cadena vacía, que es lo
 * que ese input espera (un `null` lo vuelve no controlado y React se queja).
 */
export function isoToMexicoLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const dt = DateTime.fromISO(iso, { zone: 'utc' })
  if (!dt.isValid) return ''
  return dt.setZone(ZONA_FIJA).toFormat("yyyy-MM-dd'T'HH:mm")
}
