import { api } from '@/shared/lib/api'
import type { DashboardSummary } from './types'

interface Envelope<T> {
  success: boolean
  data: T
}

const PATH = '/superadmin/dashboard'

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await api.get<Envelope<DashboardSummary>>(`${PATH}/summary`)
  return data.data
}
