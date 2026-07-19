import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  assignCompPlan,
  createVenueWizard,
  extendPlanTrial,
  fetchFeatures,
  fetchMerchantAccountOptions,
  fetchOrganizations,
  fetchVenueDetail,
  fetchVenuePaymentConfig,
  fetchVenueTerminalBrands,
  fetchVenues,
  getVenuePlan,
  saveVenuePaymentConfig,
  setVenueGrandfathered,
  type CompPlanTier,
  type CreateVenuePayload,
  type FetchVenuesParams,
  type SaveVenuePaymentConfigInput,
  type TrialPlanTier,
} from './api'
import type { Venue, VenuePlanState } from './types'

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
 * Cuando `approveKyc === true`, se envía `activateImmediately: true` al wizard: el backend crea el
 * venue directo en `ACTIVE` y lo registra en ActivityLog (`VENUE_CREATED` + `VENUE_APPROVED`) en el
 * MISMO request. Ya NO hay un 2º POST a `/approve` — esa ruta exigía `PENDING_ACTIVATION` y el
 * wizard crea el venue en `ONBOARDING`, así que el approve siempre fallaba.
 */
export function useCreateVenue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { payload: CreateVenuePayload; approveKyc: boolean }) =>
      createVenueWizard({ ...input.payload, activateImmediately: input.approveKyc }),
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

export function useVenuePaymentConfig(venueId: string | undefined) {
  return useQuery({
    queryKey: ['superadmin', 'venues', 'payment-config', venueId ?? null],
    queryFn: () => fetchVenuePaymentConfig(venueId as string),
    enabled: !!venueId,
    staleTime: 15_000,
  })
}

export function useMerchantAccountOptions() {
  return useQuery({
    queryKey: ['superadmin', 'merchant-account-options'],
    queryFn: fetchMerchantAccountOptions,
    staleTime: 5 * 60_000,
  })
}

export function useVenueTerminalBrands(venueId: string | undefined) {
  return useQuery({
    queryKey: ['superadmin', 'venues', 'terminal-brands', venueId ?? null],
    queryFn: () => fetchVenueTerminalBrands(venueId as string),
    enabled: !!venueId,
    staleTime: 60_000,
  })
}

export function useVenuePlan(venueId: string | undefined) {
  return useQuery({
    queryKey: [...VENUES_QUERY_KEY, 'plan', venueId ?? null],
    queryFn: () => getVenuePlan(venueId as string),
    enabled: !!venueId,
    staleTime: 15_000,
  })
}

/**
 * Acciones de plan-admin del venue (grandfathered, plan comp, trial). Cada
 * POST devuelve el `PlanState` fresco — lo escribimos directo al cache de
 * `useVenuePlan` (sin refetch extra) y mostramos un toast en español. Los
 * errores pasan por `inspectApiError`, igual que en subscriptions.
 */
export function useVenuePlanActions(venueId: string) {
  const qc = useQueryClient()

  const applyFresh = (plan: VenuePlanState) => {
    qc.setQueryData([...VENUES_QUERY_KEY, 'plan', venueId], plan)
  }

  const toggleGrandfathered = useMutation({
    mutationFn: (grandfathered: boolean) => setVenueGrandfathered(venueId, grandfathered),
    onSuccess: (plan, grandfathered) => {
      applyFresh(plan)
      toast.success(
        grandfathered
          ? 'Venue marcado como grandfathered — opera sin paywalls ni límites'
          : 'Grandfathered removido — el venue entra al modelo de planes',
      )
    },
    onError: (e) => {
      const i = inspectApiError(e, 'actualizar el estado grandfathered')
      toast.error(i.title, { description: i.description })
    },
  })

  const assignComp = useMutation({
    mutationFn: (tier: CompPlanTier) => assignCompPlan(venueId, tier),
    onSuccess: (plan, tier) => {
      applyFresh(plan)
      toast.success(
        tier === 'FREE'
          ? 'Plan base removido — el venue queda en Free'
          : `Plan ${tier === 'PRO' ? 'Pro' : 'Premium'} comp asignado (permanente, sin cobro)`,
      )
    },
    onError: (e) => {
      const i = inspectApiError(e, 'asignar el plan comp')
      toast.error(i.title, { description: i.description })
    },
  })

  const grantTrial = useMutation({
    mutationFn: (v: { tier: TrialPlanTier; days: number }) =>
      extendPlanTrial(venueId, v.tier, v.days),
    onSuccess: (plan, v) => {
      applyFresh(plan)
      toast.success(
        `${v.days} día(s) de prueba ${v.tier === 'PRO' ? 'Pro' : 'Premium'} otorgados al venue`,
      )
    },
    onError: (e) => {
      const i = inspectApiError(e, 'otorgar días de prueba')
      toast.error(i.title, { description: i.description })
    },
  })

  return { toggleGrandfathered, assignComp, grantTrial }
}

export function useSaveVenuePaymentConfig(venueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { exists: boolean; input: SaveVenuePaymentConfigInput }) =>
      saveVenuePaymentConfig(venueId, vars.exists, vars.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'venues', 'payment-config', venueId] })
      qc.invalidateQueries({ queryKey: VENUES_QUERY_KEY })
    },
  })
}
