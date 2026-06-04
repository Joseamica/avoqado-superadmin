import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  activateVenuePlan,
  adjustVenuePlanEndDate,
  deactivateVenuePlan,
  fetchSubscriptionOverview,
  fetchVenueSubscriptions,
  grantVenuePlanTrial,
  type FetchVenueSubscriptionsParams,
} from './api'

export const SUBSCRIPTIONS_QUERY_KEY = ['superadmin', 'subscriptions'] as const

export function useSubscriptionOverview() {
  return useQuery({
    queryKey: [...SUBSCRIPTIONS_QUERY_KEY, 'overview'],
    queryFn: fetchSubscriptionOverview,
    staleTime: 60_000,
  })
}

export function useVenueSubscriptions(params: FetchVenueSubscriptionsParams = {}) {
  return useQuery({
    queryKey: [...SUBSCRIPTIONS_QUERY_KEY, 'venues', params],
    queryFn: () => fetchVenueSubscriptions(params),
    staleTime: 60_000,
  })
}

/**
 * Acciones de gestión del plan por venue (activar, desactivar, regalar días,
 * ajustar fin). Cada mutación, al terminar, invalida TANTO el overview (KPIs +
 * MRR de la flota) COMO la lista de venues, y muestra un toast en español.
 * Los errores pasan por `inspectApiError` para no enseñar mensajes crudos.
 */
export function useSubscriptionActions() {
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [...SUBSCRIPTIONS_QUERY_KEY, 'overview'] })
    qc.invalidateQueries({ queryKey: [...SUBSCRIPTIONS_QUERY_KEY, 'venues'] })
  }

  const activate = useMutation({
    mutationFn: (venueId: string) => activateVenuePlan(venueId),
    onSuccess: (row) => {
      invalidate()
      toast.success(`Plan activado para ${row?.name ?? 'el venue'}`)
    },
    onError: (e) => {
      const i = inspectApiError(e, 'activar el plan')
      toast.error(i.title, { description: i.description })
    },
  })

  const deactivate = useMutation({
    mutationFn: (venueId: string) => deactivateVenuePlan(venueId),
    onSuccess: (row) => {
      invalidate()
      toast.success(`Plan desactivado para ${row?.name ?? 'el venue'}`)
    },
    onError: (e) => {
      const i = inspectApiError(e, 'desactivar el plan')
      toast.error(i.title, { description: i.description })
    },
  })

  const grantTrial = useMutation({
    mutationFn: (v: { venueId: string; days: number }) => grantVenuePlanTrial(v.venueId, v.days),
    onSuccess: (row, v) => {
      invalidate()
      toast.success(`${v.days} día(s) de prueba otorgados a ${row?.name ?? 'el venue'}`)
    },
    onError: (e) => {
      const i = inspectApiError(e, 'otorgar días de prueba')
      toast.error(i.title, { description: i.description })
    },
  })

  const adjustEndDate = useMutation({
    mutationFn: (v: { venueId: string; deltaDays: number }) =>
      adjustVenuePlanEndDate(v.venueId, v.deltaDays),
    onSuccess: (row, v) => {
      invalidate()
      const verb = v.deltaDays >= 0 ? 'extendido' : 'reducido'
      toast.success(
        `Fin del plan ${verb} ${Math.abs(v.deltaDays)} día(s) en ${row?.name ?? 'el venue'}`,
      )
    },
    onError: (e) => {
      const i = inspectApiError(e, 'ajustar el fin del plan')
      toast.error(i.title, { description: i.description })
    },
  })

  return { activate, deactivate, grantTrial, adjustEndDate }
}
