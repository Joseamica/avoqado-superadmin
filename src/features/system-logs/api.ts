import { api } from '@/shared/lib/api'
import type { SystemLogsQueryParams, SystemLogsResponse } from './types'

interface Envelope<T> {
  success: boolean
  data: T
}

const PATH = '/superadmin/system-logs'

export async function fetchSystemLogs(
  params: SystemLogsQueryParams = {},
): Promise<SystemLogsResponse> {
  const cleaned: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    cleaned[key] = value
  }

  const { data } = await api.get<Envelope<SystemLogsResponse>>(PATH, { params: cleaned })
  return (
    data?.data ?? {
      enabled: false,
      disabledReason: 'Empty response from server.',
      logs: [],
      hasMore: false,
    }
  )
}
