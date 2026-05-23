import { useQuery } from '@tanstack/react-query'
import { fetchDashboardSummary } from './api'

export const DASHBOARD_SUMMARY_QUERY_KEY = ['superadmin', 'dashboard', 'summary'] as const

export function useDashboardSummary() {
  return useQuery({
    queryKey: DASHBOARD_SUMMARY_QUERY_KEY,
    queryFn: fetchDashboardSummary,
    staleTime: 30_000,
  })
}
