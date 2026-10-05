import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPriceBoard, fetchPriceGaps, fetchPriceGapVenues } from './pricing-api'

const PRICING = ['pricing'] as const

export const usePriceBoard = () =>
  useQuery({ queryKey: [...PRICING, 'board'], queryFn: fetchPriceBoard, staleTime: 30_000 })

export const usePriceGaps = () =>
  useQuery({ queryKey: [...PRICING, 'gaps'], queryFn: fetchPriceGaps, staleTime: 30_000 })

export const usePriceGapVenues = (productKey: string, page: number) =>
  useQuery({
    queryKey: [...PRICING, 'gaps', productKey, page],
    queryFn: () => fetchPriceGapVenues(productKey, page),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

/** Every write on this screen refreshes the board and the previous-rate notices. */
export function useInvalidatePricing() {
  const cache = useQueryClient()
  return () => cache.invalidateQueries({ queryKey: PRICING })
}
