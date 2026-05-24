import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { fetchSystemLogs } from './api'
import type { SystemLogsQueryParams, SystemLogsResponse } from './types'

export const SYSTEM_LOGS_QUERY_KEY = ['superadmin', 'system-logs'] as const

interface UseSystemLogsOptions extends Omit<
  UseQueryOptions<SystemLogsResponse>,
  'queryKey' | 'queryFn'
> {
  /**
   * Auto-refetch interval in seconds while the tab is focused. Default 10.
   * Pasa `false` para pausar el polling (el caller puede seguir disparando
   * refetches manuales con `query.refetch()`).
   */
  refetchEverySeconds?: number | false
}

export function useSystemLogs(
  params: SystemLogsQueryParams = {},
  options: UseSystemLogsOptions = {},
) {
  const { refetchEverySeconds = 10, ...rest } = options
  return useQuery<SystemLogsResponse>({
    queryKey: [...SYSTEM_LOGS_QUERY_KEY, params],
    queryFn: () => fetchSystemLogs(params),
    staleTime: 5_000,
    refetchInterval: refetchEverySeconds === false ? false : refetchEverySeconds * 1000,
    refetchIntervalInBackground: false,
    ...rest,
  })
}
