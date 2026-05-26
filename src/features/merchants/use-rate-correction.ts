import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applyRateCorrection,
  listRateCorrections,
  previewRateCorrection,
  reverseRateCorrection,
  type RateCorrectionParams,
} from './api'
import { MERCHANTS_QUERY_KEY } from './use-merchants'

export const RATE_CORRECTION_KEY = ['superadmin', 'rate-corrections'] as const

export function useApplyRateCorrection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { venueId: string; params: RateCorrectionParams }) =>
      applyRateCorrection(v.venueId, v.params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY })
      qc.invalidateQueries({ queryKey: ['superadmin', 'earnings'] })
      qc.invalidateQueries({ queryKey: RATE_CORRECTION_KEY })
    },
  })
}

export function useReverseRateCorrection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (batchId: string) => reverseRateCorrection(batchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY })
      qc.invalidateQueries({ queryKey: ['superadmin', 'earnings'] })
      qc.invalidateQueries({ queryKey: RATE_CORRECTION_KEY })
    },
  })
}

export function useRateCorrections(venueId?: string) {
  return useQuery({
    queryKey: [...RATE_CORRECTION_KEY, venueId ?? null],
    queryFn: () => listRateCorrections(venueId),
    staleTime: 30_000,
  })
}

export { previewRateCorrection }
