import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchVenueAccessCandidates, grantVenueAccess, type VenueAccessGrant } from './api'
import { TERMINALS_QUERY_KEY } from './use-terminals'

/* --- Acceso de staff a un venue (carry-over al migrar TPV) --- */

export const VENUE_ACCESS_CANDIDATES_QUERY_KEY = [
  'superadmin',
  'venue-access',
  'candidates',
] as const

/**
 * Candidatos a recibir acceso en `venueId`. `sourceVenueId` opcional — cuando
 * viene del flujo de migración, los del venue origen se marcan y traen su
 * rol/PIN pre-seleccionados. `enabled` permite diferir la carga hasta que el
 * paso esté visible (ej. cuando el wizard llega al step de staff).
 *
 * Sin stale time alto: los candidatos dependen del estado actual del staff y
 * de qué PINs están libres en el destino; 0 stale mantiene el picker fresco
 * cada vez que se abre.
 */
export function useVenueAccessCandidates(
  venueId: string | undefined,
  sourceVenueId?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: [...VENUE_ACCESS_CANDIDATES_QUERY_KEY, venueId ?? null, sourceVenueId ?? null],
    queryFn: () => {
      if (!venueId) throw new Error('venueId is required')
      return fetchVenueAccessCandidates(venueId, sourceVenueId)
    },
    enabled: enabled && !!venueId,
    staleTime: 0,
  })
}

/**
 * Aplica los grants de acceso. Invalida la lista de candidatos (para reflejar
 * `alreadyAtDestination`/PIN actualizado) y la de terminals (el blocker
 * `NO_STAFF_PIN` del preflight de migración deja de aplicar cuando alguien con
 * PIN quedó en el destino).
 */
export function useGrantVenueAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { venueId: string; grants: VenueAccessGrant[] }) =>
      grantVenueAccess(input.venueId, input.grants),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VENUE_ACCESS_CANDIDATES_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: TERMINALS_QUERY_KEY })
    },
  })
}
