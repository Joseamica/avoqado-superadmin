import { api } from '@/shared/lib/api'
import type { ActivityLogQueryParams, ActivityLogResponse } from './types'

interface Envelope<T> {
  success: boolean
  data: T
}

const PATH = '/superadmin/activity-log'

/**
 * Fetch a page of superadmin activity logs.
 * Server envelopes the payload in `{ success, data }` — we unwrap here so the
 * caller (and TanStack Query) sees the actual `ActivityLogResponse`.
 */
export async function fetchActivityLog(
  params: ActivityLogQueryParams = {},
): Promise<ActivityLogResponse> {
  const { data } = await api.get<Envelope<ActivityLogResponse>>(PATH, {
    params: cleanParams(params),
  })
  return data.data
}

export async function fetchActivityLogActions(): Promise<string[]> {
  const { data } = await api.get<Envelope<string[]>>(`${PATH}/actions`)
  return data.data
}

export async function fetchActivityLogEntities(): Promise<string[]> {
  const { data } = await api.get<Envelope<string[]>>(`${PATH}/entities`)
  return data.data
}

function cleanParams(params: ActivityLogQueryParams): Record<string, string | number> {
  const cleaned: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    cleaned[key] = value
  }
  return cleaned
}
