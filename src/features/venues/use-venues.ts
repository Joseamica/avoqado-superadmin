import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchVenueDetail, fetchVenues, type FetchVenuesParams } from './api'
import type { Venue } from './types'

export const VENUES_QUERY_KEY = ['superadmin', 'venues'] as const

export function useVenues(params: FetchVenuesParams = {}) {
  return useQuery({
    queryKey: [...VENUES_QUERY_KEY, params],
    queryFn: () => fetchVenues(params),
    // Venues no cambian segundo a segundo — un minuto stale es razonable y
    // evita refetch en cada navegación al volver desde el detalle.
    staleTime: 60_000,
  })
}

export function useVenueDetail(venueId: string | undefined) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: [...VENUES_QUERY_KEY, 'detail', venueId ?? null],
    queryFn: () => {
      if (!venueId) throw new Error('venueId is required')
      return fetchVenueDetail(venueId)
    },
    enabled: !!venueId,
    staleTime: 30_000,
    // Optimistic render: si el usuario llegó al detalle desde la lista, ya
    // tenemos el row entero en cache. Lo usamos como placeholder para que la
    // página aparezca instantánea; el fetch real corre en background y
    // actualiza si algo cambió.
    placeholderData: () => {
      if (!venueId) return undefined
      const caches = queryClient.getQueriesData<Venue[]>({ queryKey: VENUES_QUERY_KEY })
      for (const [, list] of caches) {
        const hit = list?.find((v) => v.id === venueId)
        if (hit) return hit
      }
      return undefined
    },
  })
}
