import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPaymentProvider,
  deletePaymentProvider,
  fetchPaymentProvider,
  fetchPaymentProviders,
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
