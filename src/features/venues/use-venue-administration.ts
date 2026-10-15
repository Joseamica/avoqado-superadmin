import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  fetchVenueAdministration,
  updateVenueAdministration,
  type AdministrationUpdate,
} from './administration-api'

export const ADMINISTRATION_QUERY_KEY = ['superadmin', 'venue-administration'] as const

export function useVenueAdministration(venueId: string) {
  return useQuery({
    queryKey: [...ADMINISTRATION_QUERY_KEY, venueId],
    queryFn: () => fetchVenueAdministration(venueId),
    staleTime: 30_000,
  })
}

export function useUpdateVenueAdministration(venueId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (update: AdministrationUpdate) => updateVenueAdministration(venueId, update),
    onSuccess: (data) => {
      queryClient.setQueryData([...ADMINISTRATION_QUERY_KEY, venueId], data)
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'venues'] })
      void queryClient.invalidateQueries({ queryKey: ADMINISTRATION_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'organizations'] })
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'activity-log'] })
      toast.success('Datos administrativos guardados')
    },
    onError: (error) => {
      const info = inspectApiError(error, 'guardar los datos administrativos')
      toast.error(info.title, { description: info.description })
    },
  })
}
