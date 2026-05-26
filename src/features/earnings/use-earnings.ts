import { useQuery } from '@tanstack/react-query'
import { fetchEarningsSummary, fetchEarningsTimeSeries, type EarningsRangeParams } from './api'
import type { Granularity } from './types'

export function useEarningsSummary(range: EarningsRangeParams) {
  return useQuery({
    queryKey: [
      'superadmin',
      'earnings',
      'summary',
      range.startDate,
      range.endDate,
      range.venueId,
      range.merchantAccountId,
    ],
    queryFn: () => fetchEarningsSummary(range),
  })
}

export function useEarningsTimeSeries(range: EarningsRangeParams, granularity: Granularity) {
  return useQuery({
    queryKey: [
      'superadmin',
      'earnings',
      'time-series',
      range.startDate,
      range.endDate,
      range.venueId,
      range.merchantAccountId,
      granularity,
    ],
    queryFn: () => fetchEarningsTimeSeries({ ...range, granularity }),
  })
}
