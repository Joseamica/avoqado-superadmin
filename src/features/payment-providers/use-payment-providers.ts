import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPaymentProvider,
  deleteCostStructure,
  deleteEcommerceMerchant,
  deleteMerchantAccount,
  deletePaymentProvider,
  detachTerminalFromMerchant,
  fetchMerchantBlockers,
  fetchPaymentProvider,
  fetchPaymentProviders,
  fetchProviderBlockers,
  forceDeletePaymentProvider,
  togglePaymentProvider,
  updatePaymentProvider,
  type CreatePaymentProviderPayload,
  type FetchProvidersParams,
  type UpdatePaymentProviderPayload,
} from './api'
import type { PaymentProvider } from './types'

export const PAYMENT_PROVIDERS_QUERY_KEY = ['superadmin', 'payment-providers'] as const

export function usePaymentProviders(params: FetchProvidersParams = {}) {
  return useQuery({
    queryKey: [...PAYMENT_PROVIDERS_QUERY_KEY, params],
    queryFn: () => fetchPaymentProviders(params),
    // Providers cambian rara vez — 2 min stale es seguro.
    staleTime: 2 * 60_000,
  })
}

export function usePaymentProvider(id: string | undefined) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: [...PAYMENT_PROVIDERS_QUERY_KEY, 'detail', id ?? null],
    queryFn: () => {
      if (!id) throw new Error('id is required')
      return fetchPaymentProvider(id)
    },
    enabled: !!id,
    staleTime: 60_000,
    placeholderData: () => {
      if (!id) return undefined
      const caches = queryClient.getQueriesData<PaymentProvider[]>({
        queryKey: PAYMENT_PROVIDERS_QUERY_KEY,
      })
      for (const [, list] of caches) {
        const hit = list?.find((p) => p.id === id)
        if (hit) return hit
      }
      return undefined
    },
  })
}

export function useCreatePaymentProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreatePaymentProviderPayload) => createPaymentProvider(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_PROVIDERS_QUERY_KEY })
    },
  })
}

export function useUpdatePaymentProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; payload: UpdatePaymentProviderPayload }) =>
      updatePaymentProvider(input.id, input.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_PROVIDERS_QUERY_KEY })
    },
  })
}

/**
 * Toggle activo/inactivo. Optimistic — actualizamos el cache inmediato
 * para que el switch responda sin esperar el roundtrip; si falla, hacemos
 * rollback al estado previo y mostramos toast de error en el caller.
 */
export function useTogglePaymentProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => togglePaymentProvider(id),
    onMutate: async (id) => {
      // Cancelar refetches in-flight para que no sobrescriban nuestro optimistic.
      await queryClient.cancelQueries({ queryKey: PAYMENT_PROVIDERS_QUERY_KEY })
      const snapshots = queryClient.getQueriesData<PaymentProvider[]>({
        queryKey: PAYMENT_PROVIDERS_QUERY_KEY,
      })
      // Flip el `active` flag en TODA query cacheada que contenga este provider.
      for (const [key, list] of snapshots) {
        if (!Array.isArray(list)) continue
        queryClient.setQueryData<PaymentProvider[]>(key, (old) =>
          (old ?? []).map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
        )
      }
      return { snapshots }
    },
    onError: (_err, _id, context) => {
      // Rollback.
      if (!context?.snapshots) return
      for (const [key, value] of context.snapshots) {
        queryClient.setQueryData(key, value)
      }
    },
    onSettled: () => {
      // Refresh source-of-truth.
      queryClient.invalidateQueries({ queryKey: PAYMENT_PROVIDERS_QUERY_KEY })
    },
  })
}

export function useDeletePaymentProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePaymentProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_PROVIDERS_QUERY_KEY })
    },
  })
}

/* --- Borrado guiado --- */

/** Bloqueadores de borrado de un provider. Se refetchea tras quitar cada dependencia. */
export function useProviderBlockers(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...PAYMENT_PROVIDERS_QUERY_KEY, 'blockers', id ?? null],
    queryFn: () => {
      if (!id) throw new Error('id is required')
      return fetchProviderBlockers(id)
    },
    enabled: !!id && enabled,
    staleTime: 0,
  })
}

/** Quita un merchant account (puede fallar con historial — el caller muestra el error). */
export function useRemoveMerchantAccount(providerId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (merchantId: string) => deleteMerchantAccount(merchantId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...PAYMENT_PROVIDERS_QUERY_KEY, 'blockers', providerId ?? null],
      })
      queryClient.invalidateQueries({ queryKey: PAYMENT_PROVIDERS_QUERY_KEY })
    },
  })
}

/** Quita un canal e-commerce (sólo sin historial). */
export function useRemoveEcommerceMerchant(providerId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ecommerceMerchantId: string) => deleteEcommerceMerchant(ecommerceMerchantId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...PAYMENT_PROVIDERS_QUERY_KEY, 'blockers', providerId ?? null],
      })
    },
  })
}

/** Borrado REAL del provider — sólo procede si está limpio (si no, 400 con detalle). */
export function useForceDeletePaymentProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => forceDeletePaymentProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_PROVIDERS_QUERY_KEY })
    },
  })
}

/* --- Borrado guiado: bloqueadores propios del merchant (Paso 2) --- */

export function useMerchantBlockers(merchantId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...PAYMENT_PROVIDERS_QUERY_KEY, 'merchant-blockers', merchantId ?? null],
    queryFn: () => {
      if (!merchantId) throw new Error('merchantId is required')
      return fetchMerchantBlockers(merchantId)
    },
    enabled: !!merchantId && enabled,
    staleTime: 0,
  })
}

function useMerchantBlockerMutation(
  providerId: string | undefined,
  merchantId: string,
  mutationFn: (arg: string) => Promise<void>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...PAYMENT_PROVIDERS_QUERY_KEY, 'merchant-blockers', merchantId],
      })
      queryClient.invalidateQueries({
        queryKey: [...PAYMENT_PROVIDERS_QUERY_KEY, 'blockers', providerId ?? null],
      })
    },
  })
}

/** Desasigna una terminal del merchant. */
export function useDetachTerminal(providerId: string | undefined, merchantId: string) {
  return useMerchantBlockerMutation(providerId, merchantId, (terminalId) =>
    detachTerminalFromMerchant(merchantId, terminalId),
  )
}

/** Quita una estructura de costo del merchant. */
export function useRemoveCostStructure(providerId: string | undefined, merchantId: string) {
  return useMerchantBlockerMutation(providerId, merchantId, (costStructureId) =>
    deleteCostStructure(costStructureId),
  )
}
