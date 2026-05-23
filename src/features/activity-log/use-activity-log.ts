import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { fetchActivityLog } from './api'
import type { ActivityLogQueryParams, ActivityLogResponse } from './types'

/**
 * Query key root matches `EVENT_INVALIDATIONS` in
 * `src/features/realtime/use-realtime-invalidation.ts` so server events
 * (`superadmin:activity-log:new`) refetch this exact query.
 */
export const ACTIVITY_LOG_QUERY_KEY = ['superadmin', 'activity-log'] as const

export function useActivityLog(
  params: ActivityLogQueryParams = {},
  options?: Omit<UseQueryOptions<ActivityLogResponse>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ActivityLogResponse>({
    queryKey: [...ACTIVITY_LOG_QUERY_KEY, params],
    queryFn: () => fetchActivityLog(params),
    staleTime: 30_000,
    ...options,
  })
}
