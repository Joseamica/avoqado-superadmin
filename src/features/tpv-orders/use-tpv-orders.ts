import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignSerialsAuthenticated,
  getTpvOrder,
  listTpvOrders,
  markDelivered,
  markShipped,
} from './api'
import type { AssignSerialsPayload, TerminalOrder } from './types'

/**
 * Query keys del feature. Se agrupan bajo el namespace `superadmin` para
 * que el hook de realtime (`use-realtime-invalidation.ts`) pueda invalidar
 * todo a la vez si en el futuro emitimos `superadmin:tpv-order:updated`.
 */
export const TPV_ORDERS_QUERY_KEY = ['superadmin', 'tpv-orders'] as const

export function useTpvOrders() {
  return useQuery({
    queryKey: TPV_ORDERS_QUERY_KEY,
    queryFn: listTpvOrders,
    staleTime: 30_000,
  })
}

export function useTpvOrder(id: string | undefined) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: [...TPV_ORDERS_QUERY_KEY, 'detail', id ?? null],
    queryFn: () => {
      if (!id) throw new Error('id is required')
      return getTpvOrder(id)
    },
    enabled: !!id,
    staleTime: 15_000,
    // Si la lista ya está en cache, mostramos el row mientras carga el detail.
    placeholderData: () => {
      if (!id) return undefined
      const lists = queryClient.getQueriesData<TerminalOrder[]>({ queryKey: TPV_ORDERS_QUERY_KEY })
      for (const [, list] of lists) {
        const hit = list?.find((o) => o.id === id)
        if (hit) return hit
      }
      return undefined
    },
  })
}

export function useAssignSerials(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: AssignSerialsPayload) => {
      if (!id) throw new Error('id is required')
      return assignSerialsAuthenticated(id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TPV_ORDERS_QUERY_KEY })
    },
  })
}

export function useMarkShipped(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { trackingNumber: string; carrier: string }) => {
      if (!id) throw new Error('id is required')
      return markShipped(id, vars.trackingNumber, vars.carrier)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TPV_ORDERS_QUERY_KEY })
    },
  })
}

export function useMarkDelivered(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (!id) throw new Error('id is required')
      return markDelivered(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TPV_ORDERS_QUERY_KEY })
    },
  })
}
