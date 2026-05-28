import { api } from '@/shared/lib/api'
import type { EarningsSummary, EarningsTimePoint, Granularity } from './types'

export interface EarningsRangeParams {
  startDate?: string
  endDate?: string
  venueId?: string
  merchantAccountId?: string
}

/**
 * Lower bound to request when no period filter is set, so Ganancias shows ALL
 * history by default — not the current month. The backend's `resolveRange`
 * defaults an absent `startDate` to the first of the current month; sending an
 * explicit epoch floor overrides that to "todo el histórico". The pill stays
 * unfiltered (so "Limpiar" returns here), but the data spans everything.
 */
export const EARNINGS_ALL_TIME_START = '1970-01-01T00:00:00.000Z'

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
