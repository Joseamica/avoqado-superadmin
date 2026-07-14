import { api } from '@/shared/lib/api'
import type { SettlementCalendar } from './types'

/** `month` es `YYYY-MM`. El backend lo expande al mes calendario completo. */
export async function fetchSettlementCalendar(month: string): Promise<SettlementCalendar> {
  const { data } = await api.get<{ success: boolean; data: SettlementCalendar }>(
    '/superadmin/settlement-calendar',
    { params: { month } },
  )
  if (!data?.data) throw new Error('El servidor devolvió una respuesta vacía para el calendario')
  return data.data
}
