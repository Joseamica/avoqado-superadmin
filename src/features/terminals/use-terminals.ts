import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTerminal,
  deleteTerminal,
  fetchAppVersions,
  fetchMerchantAccounts,
  fetchTerminalDetail,
  fetchTerminals,
  fetchTpvSettings,
  generateActivationCode,
  remoteActivate,
  sendCommand,
  updateTerminal,
  updateTpvSettings,
  type CreateTerminalPayload,
  type FetchTerminalsParams,
  type TpvSettings,
  type UpdateTerminalPayload,
} from './api'
import type { Terminal, TpvCommand } from './types'

export const TERMINALS_QUERY_KEY = ['superadmin', 'terminals'] as const

export function useTerminals(params: FetchTerminalsParams = {}) {
  return useQuery({
    queryKey: [...TERMINALS_QUERY_KEY, params],
    queryFn: () => fetchTerminals(params),
    // Heartbeat-driven status — refetch cada 30s para que online/offline
    // se mueva en algo cercano a tiempo real sin spammear al server.
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}

export function useTerminalDetail(terminalId: string | undefined) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: [...TERMINALS_QUERY_KEY, 'detail', terminalId ?? null],
    queryFn: () => {
      if (!terminalId) throw new Error('terminalId is required')
      return fetchTerminalDetail(terminalId)
    },
    enabled: !!terminalId,
    staleTime: 10_000,
    placeholderData: () => {
      if (!terminalId) return undefined
      const caches = queryClient.getQueriesData<Terminal[]>({ queryKey: TERMINALS_QUERY_KEY })
      for (const [, list] of caches) {
        const hit = list?.find((t) => t.id === terminalId)
        if (hit) return hit
      }
      return undefined
    },
  })
}

/**
 * Mutation para enviar comandos genéricos. Después del POST invalida la
 * query del listado + del detail para que `lastHeartbeat`, `status`, etc.
 * reflejen la respuesta del terminal (que llega vía Socket.IO al server
 * y de ahí a este client en el siguiente refetch).
 */
export function useTerminalCommand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      terminalId: string
      command: TpvCommand
      payload?: Record<string, unknown>
    }) => {
      return sendCommand(input.terminalId, input.command, input.payload)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: TERMINALS_QUERY_KEY })
      queryClient.invalidateQueries({
        queryKey: [...TERMINALS_QUERY_KEY, 'detail', variables.terminalId],
      })
    },
  })
}

export function useUpdateTerminal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { terminalId: string; payload: UpdateTerminalPayload }) => {
      return updateTerminal(input.terminalId, input.payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TERMINALS_QUERY_KEY })
    },
  })
}

export function useGenerateActivationCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (terminalId: string) => generateActivationCode(terminalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TERMINALS_QUERY_KEY })
    },
  })
}

export function useRemoteActivate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (terminalId: string) => remoteActivate(terminalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TERMINALS_QUERY_KEY })
    },
  })
}

/**
 * Lista de versiones publicadas del AvoqadoPOS — alimenta el Combobox de
 * `INSTALL_VERSION` en el drawer. Las versiones no cambian segundo a segundo,
 * 5 min stale es seguro.
 */
export const APP_VERSIONS_QUERY_KEY = ['superadmin', 'app-versions'] as const

export function useAppVersions() {
  return useQuery({
    queryKey: APP_VERSIONS_QUERY_KEY,
    queryFn: fetchAppVersions,
    staleTime: 5 * 60_000,
  })
}

/**
 * Alta de terminal. Después del create invalida la lista para que la
 * tabla refresh y la terminal nueva aparezca arriba (sort default es
 * `lastHeartbeat desc` → terminals fresh nuevas con heartbeat null
 * caen al final, pero ordenando por `createdAt` desc se ven arriba —
 * lo dejamos para iteración 2 si pasa a ser problema).
 */
export function useCreateTerminal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateTerminalPayload) => createTerminal(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TERMINALS_QUERY_KEY })
    },
  })
}

export const MERCHANT_ACCOUNTS_QUERY_KEY = ['superadmin', 'merchant-accounts'] as const

export function useMerchantAccounts() {
  return useQuery({
    queryKey: MERCHANT_ACCOUNTS_QUERY_KEY,
    queryFn: fetchMerchantAccounts,
    // Merchant accounts cambian rara vez — 5 min stale es seguro.
    staleTime: 5 * 60_000,
  })
}

export const TPV_SETTINGS_QUERY_KEY = ['superadmin', 'tpv-settings'] as const

/**
 * Settings runtime de una terminal (separados del `useTerminalDetail`
 * porque viven en un endpoint distinto y se modifican con su propio PUT).
 */
export function useTpvSettings(terminalId: string | undefined) {
  return useQuery({
    queryKey: [...TPV_SETTINGS_QUERY_KEY, terminalId ?? null],
    queryFn: () => {
      if (!terminalId) throw new Error('terminalId is required')
      return fetchTpvSettings(terminalId)
    },
    enabled: !!terminalId,
    staleTime: 60_000,
  })
}

export function useUpdateTpvSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { terminalId: string; patch: Partial<TpvSettings> }) => {
      return updateTpvSettings(input.terminalId, input.patch)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...TPV_SETTINGS_QUERY_KEY, variables.terminalId],
      })
    },
  })
}

export function useDeleteTerminal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (terminalId: string) => deleteTerminal(terminalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TERMINALS_QUERY_KEY })
    },
  })
}
