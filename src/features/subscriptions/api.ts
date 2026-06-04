/**
 * API client del feature Subscriptions.
 *
 * Apunta al namespace NUEVO `/api/v1/superadmin/subscriptions/*` (separado del
 * feature `venues`, que consume el legacy `/dashboard/superadmin/*`). Estos
 * endpoints son SUPERADMIN-only y devuelven el envelope `{ success, data }`
 * como el resto del namespace superadmin — lo desenvolvemos acá.
 */
import { api } from '@/shared/lib/api'
import type { SubscriptionOverview, SuperadminVenueSubscription, SubscriptionState } from './types'

interface SuperadminEnvelope<T> {
  success: boolean
  data: T
  meta?: { total: number; page: number; pageSize: number }
}

const EMPTY_OVERVIEW: SubscriptionOverview = {
  counts: {
    active: 0,
    trial: 0,
    canceling: 0,
    past_due: 0,
    suspended: 0,
    canceled: 0,
    none: 0,
    total: 0,
  },
  mrr: { total: 0, currency: 'MXN' },
  trialsEndingSoon: [],
}

export async function fetchSubscriptionOverview(): Promise<SubscriptionOverview> {
  const { data } = await api.get<SuperadminEnvelope<SubscriptionOverview>>(
    '/superadmin/subscriptions/overview',
  )
  // Defensa contra payload mal formado — overview vacío en vez de crashear el header.
  if (!data?.data?.counts) return EMPTY_OVERVIEW
  return data.data
}

export interface FetchVenueSubscriptionsParams {
  state?: SubscriptionState
  q?: string
  page?: number
  pageSize?: number
}

export async function fetchVenueSubscriptions(
  params: FetchVenueSubscriptionsParams = {},
): Promise<SuperadminVenueSubscription[]> {
  const { data } = await api.get<SuperadminEnvelope<SuperadminVenueSubscription[]>>(
    '/superadmin/subscriptions/venues',
    {
      params: {
        state: params.state,
        q: params.q,
        page: params.page,
        pageSize: params.pageSize ?? 200,
      },
    },
  )
  if (!Array.isArray(data?.data)) return []
  return data.data
}

/**
 * Acciones de gestión por venue (todas POST, SUPERADMIN-only). Devuelven el
 * mismo envelope `{ success, data }` con la fila actualizada — la desenvolvemos
 * y regresamos `data.data` para que el caller refresque el row optimistamente.
 */

export async function activateVenuePlan(venueId: string): Promise<SuperadminVenueSubscription> {
  const { data } = await api.post<SuperadminEnvelope<SuperadminVenueSubscription>>(
    `/superadmin/subscriptions/venues/${encodeURIComponent(venueId)}/activate`,
  )
  return data.data
}

export async function deactivateVenuePlan(venueId: string): Promise<SuperadminVenueSubscription> {
  const { data } = await api.post<SuperadminEnvelope<SuperadminVenueSubscription>>(
    `/superadmin/subscriptions/venues/${encodeURIComponent(venueId)}/deactivate`,
  )
  return data.data
}

export async function grantVenuePlanTrial(
  venueId: string,
  days: number,
): Promise<SuperadminVenueSubscription> {
  const { data } = await api.post<SuperadminEnvelope<SuperadminVenueSubscription>>(
    `/superadmin/subscriptions/venues/${encodeURIComponent(venueId)}/grant-trial`,
    { days },
  )
  return data.data
}

export async function adjustVenuePlanEndDate(
  venueId: string,
  deltaDays: number,
): Promise<SuperadminVenueSubscription> {
  const { data } = await api.post<SuperadminEnvelope<SuperadminVenueSubscription>>(
    `/superadmin/subscriptions/venues/${encodeURIComponent(venueId)}/adjust-end-date`,
    { deltaDays },
  )
  return data.data
}
