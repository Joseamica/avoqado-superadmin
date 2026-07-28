import { api } from '@/shared/lib/api'
import type { SettlementCalendar } from './types'

/** `month` es `YYYY-MM`. El backend lo expande al mes calendario completo. */
export async function fetchSettlementCalendar(month: string): Promise<SettlementCalendar> {
  const { data } = await api.get<{ success: boolean; data: SettlementCalendar }>(
    '/superadmin/settlement-calendar',
    { params: { month } },
  )
  if (!data?.data) throw new Error('El servidor devolvió una respuesta vacía para el calendario')

  // El backend es un deploy aparte y el front puede ir adelante. Si `merchants`
  // aún no viene, la pantalla debe seguir mostrando los totales — que son
  // correctos — y quedarse sin desglose, no romperse: es una pantalla de dinero.
  return {
    ...data.data,
    days: (data.data.days ?? []).map((d) => ({
      ...d,
      venues: (d.venues ?? []).map((v) => ({ ...v, merchants: v.merchants ?? [] })),
    })),
  }
}
