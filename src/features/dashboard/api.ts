import { api } from '@/shared/lib/api'
import type { DashboardSummary } from './types'

interface Envelope<T> {
  success: boolean
  data: T
}

const PATH = '/superadmin/dashboard'

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await api.get<Envelope<DashboardSummary>>(`${PATH}/summary`)
  if (!data?.data) {
    throw new Error('Dashboard summary returned empty — the server may be temporarily unavailable.')
  }
  return data.data
}
