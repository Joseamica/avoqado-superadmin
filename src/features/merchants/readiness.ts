/**
 * Completitud operativa de un merchant account — la tira "readiness" que abre
 * el Overview. Cada chip responde: ¿está lista esta faceta para cobrar bien?
 *
 * `state`: 'ok' (configurado), 'missing' (falta, con copy accionable),
 * 'unknown' (no pudimos determinarlo — datos no cargados).
 */
import type { MerchantAccount } from './types'

export type ReadinessState = 'ok' | 'missing' | 'unknown'

export interface ReadinessChip {
  key: 'credentials' | 'cost' | 'settlement' | 'slots' | 'terminals'
  label: string
  state: ReadinessState
  hint?: string
}

interface ReadinessExtras {
  hasSettlement?: boolean
}

export function computeReadiness(
  m: MerchantAccount,
  extras: ReadinessExtras = {},
): ReadinessChip[] {
  const chip = (
    key: ReadinessChip['key'],
    label: string,
    ok: boolean,
    hint: string,
    knowable = true,
  ): ReadinessChip => ({
    key,
    label,
    state: !knowable ? 'unknown' : ok ? 'ok' : 'missing',
    hint: ok ? undefined : hint,
  })

  return [
    chip(
      'credentials',
      'Credenciales',
      m.hasCredentials,
      'Sin credenciales — la TPV no podrá cobrar.',
    ),
    chip(
      'cost',
      'Costo proveedor',
      m.counts.costStructures > 0,
      'Sin estructura de costos — no podemos calcular margen.',
    ),
    chip(
      'settlement',
      'Liquidación',
      extras.hasSettlement === true,
      'Sin días de liquidación configurados.',
      extras.hasSettlement !== undefined,
    ),
    chip('slots', 'Slots', m.counts.venueConfigs > 0, 'No está asignada a ningún venue.'),
    chip('terminals', 'Terminales', m.counts.terminals > 0, 'Sin terminales asignadas.'),
  ]
}
