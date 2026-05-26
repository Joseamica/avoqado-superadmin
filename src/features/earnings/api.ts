import { api } from '@/shared/lib/api'
import type { EarningsSummary, EarningsTimePoint, Granularity } from './types'

export interface EarningsRangeParams {
  startDate?: string
  endDate?: string
}

export async function fetchEarningsSummary(params: EarningsRangeParams): Promise<EarningsSummary> {
  const { data } = await api.get<{ success: boolean; data: EarningsSummary }>(
    '/superadmin/earnings/summary',
    { params },
  )
  if (!data?.data) throw new Error('Server returned empty response for earnings summary')
  return data.data
}

export async function fetchEarningsTimeSeries(
  params: EarningsRangeParams & { granularity: Granularity },
): Promise<EarningsTimePoint[]> {
  const { data } = await api.get<{ success: boolean; data: EarningsTimePoint[] }>(
    '/superadmin/earnings/time-series',
    {
      params,
    },
  )
  return Array.isArray(data?.data) ? data.data : []
}
