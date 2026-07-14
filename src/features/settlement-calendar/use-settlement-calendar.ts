import { useQuery } from '@tanstack/react-query'
import { fetchSettlementCalendar } from './api'

export function useSettlementCalendar(month: string) {
  return useQuery({
    queryKey: ['superadmin', 'settlement-calendar', month],
    queryFn: () => fetchSettlementCalendar(month),
  })
}
