import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveVenueAfterCreate,
  createVenueWizard,
  fetchFeatures,
  fetchOrganizations,
  fetchVenueDetail,
  fetchVenues,
  type CreateVenuePayload,
  type FetchVenuesParams,
} from './api'
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

export const ORGANIZATIONS_QUERY_KEY = ['superadmin', 'organizations'] as const

export function useOrganizations() {
  return useQuery({
    queryKey: ORGANIZATIONS_QUERY_KEY,
    queryFn: fetchOrganizations,
    staleTime: 60_000,
  })
}

export const FEATURES_QUERY_KEY = ['superadmin', 'features'] as const

export function useFeatures() {
  return useQuery({
    queryKey: FEATURES_QUERY_KEY,
    queryFn: fetchFeatures,
    // Features cambian rara vez — 5 min stale es seguro y rápido para el wizard.
    staleTime: 5 * 60_000,
  })
}

/**
 * Mutation para crear venue desde el wizard.
 *
 * Cuando `approveKyc === true`, después de crear el venue lo aprobamos en
 * un segundo request — el backend ya registra ambas acciones en
 * ActivityLog. Si el approve falla pero el create fue OK, el venue queda
 * creado pero en `PENDING_REVIEW` (estado válido), y el caller decide qué
 * mostrar (probablemente toast warning).
 */
export function useCreateVenue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { payload: CreateVenuePayload; approveKyc: boolean }) => {
      const result = await createVenueWizard(input.payload)
      if (input.approveKyc) {
        await approveVenueAfterCreate(result.venueId)
      }
      return result
    },
    onSuccess: () => {
      // Invalidar tanto la lista de venues como la de orgs (puede haber org nueva).
      queryClient.invalidateQueries({ queryKey: VENUES_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY })
    },
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
