import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMerchant,
  deleteMerchant,
  fetchActiveCost,
  fetchAngelPayAccounts,
  fetchAssignableTerminals,
  fetchHolidays,
  fetchMerchant,
  fetchMerchants,
  fetchProviders,
  fetchRevenueShare,
  fetchSettlements,
  fetchVenueConfigs,
  fetchVenueOptions,
  fetchVenueTerminals,
  getActiveVenuePricing,
  fullSetupAngelPay,
  fullSetupBlumon,
  saveCost,
  saveRevenueShare,
  saveSettlement,
  saveVenuePricing,
  setTerminalServes,
  toggleMerchant,
  updateMerchant,
  type AngelPayFullSetupPayload,
  type BlumonFullSetupPayload,
  type CreateMerchantInput,
  type FetchMerchantsParams,
  type SaveCostInput,
  type SaveRevenueShareInput,
  type SaveVenuePricingInput,
  type SettlementRowInput,
  type UpdateMerchantInput,
} from './api'
import { cardRatesFromCost, effectiveCardRates, type AccountSlot } from './types'
import { computeMerchantEconomics, type MerchantEconomics } from './economics'

export const MERCHANTS_QUERY_KEY = ['superadmin', 'merchants'] as const

export function useMerchants(params: FetchMerchantsParams = {}) {
  return useQuery({
    queryKey: [...MERCHANTS_QUERY_KEY, params],
    queryFn: () => fetchMerchants(params),
    staleTime: 30_000,
  })
}

export function useMerchant(id: string | undefined) {
  return useQuery({
    queryKey: [...MERCHANTS_QUERY_KEY, 'detail', id ?? null],
    queryFn: () => {
      if (!id) throw new Error('merchant id is required')
      return fetchMerchant(id)
    },
    enabled: !!id,
    staleTime: 15_000,
  })
}

export const PROVIDERS_QUERY_KEY = ['superadmin', 'payment-providers'] as const

export function useProviders() {
  return useQuery({
    queryKey: PROVIDERS_QUERY_KEY,
    queryFn: fetchProviders,
    staleTime: 5 * 60_000,
  })
}

/**
 * Bundle de economía del detalle: costo + revenue-share + settlement + venue-configs
 * en paralelo. Devuelve también `economics` ya computado (merchant-level) y
 * `hasSettlement` para el readiness.
 *
 * Nota: el pricing al venue (VenuePricingStructure) es per-venue/slot — en F1A
 * el modo all-avoqado/direct-split se queda sin `venuePrice` (mode 'no-pricing'
 * o 'aggregator'); el pricing entra en F2 cuando se editen tarifas por venue.
 */
export function useMerchantEconomicsData(id: string | undefined) {
  const results = useQueries({
    queries: [
      {
        queryKey: [...MERCHANTS_QUERY_KEY, 'cost', id ?? null],
        queryFn: () => fetchActiveCost(id as string),
        enabled: !!id,
        staleTime: 30_000,
      },
      {
        queryKey: [...MERCHANTS_QUERY_KEY, 'revenue-share', id ?? null],
        queryFn: () => fetchRevenueShare(id as string),
        enabled: !!id,
        staleTime: 30_000,
      },
      {
        queryKey: [...MERCHANTS_QUERY_KEY, 'settlement', id ?? null],
        queryFn: () => fetchSettlements(id as string),
        enabled: !!id,
        staleTime: 30_000,
      },
      {
        queryKey: [...MERCHANTS_QUERY_KEY, 'venue-configs', id ?? null],
        queryFn: () => fetchVenueConfigs(id as string),
        enabled: !!id,
        staleTime: 30_000,
      },
    ],
  })

  const [costQ, revShareQ, settlementQ, venueConfigsQ] = results
  const cost = costQ.data ?? null
  const revenueShare = revShareQ.data ?? null
  const settlements = settlementQ.data ?? []
  const venueConfigs = venueConfigsQ.data ?? []

  const economics: MerchantEconomics | null = cost
    ? computeMerchantEconomics({
        cost: cardRatesFromCost(cost),
        venuePrice: null,
        revenueShare: revenueShare
          ? {
              // Efectivo (con IVA) para que las 3 capas (costo/agregador/venue) sean consistentes.
              aggregatorPrice: revenueShare.aggregatorPrice
                ? effectiveCardRates(
                    revenueShare.aggregatorPrice,
                    revenueShare.aggregatorPriceIncludesTax,
                    revenueShare.taxRate,
                  )
                : null,
              avoqadoShareOfProviderMargin: revenueShare.avoqadoShareOfProviderMargin,
              avoqadoShareOfAggregatorMargin: revenueShare.avoqadoShareOfAggregatorMargin,
              taxRate: revenueShare.taxRate,
            }
          : null,
      })
    : null

  return {
    cost,
    revenueShare,
    settlements,
    venueConfigs,
    economics,
    hasSettlement: settlements.length > 0,
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
    error: results.find((r) => r.isError)?.error ?? null,
    refetch: () => results.forEach((r) => void r.refetch()),
  }
}

export function useCreateMerchant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMerchantInput) => createMerchant(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

export function useUpdateMerchant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; input: UpdateMerchantInput }) =>
      updateMerchant(vars.id, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

export function useToggleMerchant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => toggleMerchant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

export function useDeleteMerchant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMerchant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

export function useSaveCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      merchantAccountId: string
      activeId: string | null
      input: SaveCostInput
    }) => saveCost(vars.merchantAccountId, vars.activeId, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

export function useSaveRevenueShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      merchantAccountId: string
      existingId: string | null
      input: SaveRevenueShareInput
    }) => saveRevenueShare(vars.merchantAccountId, vars.existingId, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

/**
 * Pricing activo de varios venues/slots en paralelo. Comparte la misma query key
 * que `EditVenuePricingDrawer` (`[...MERCHANTS_QUERY_KEY, 'venue-pricing', venueId, slot]`)
 * para reusar cache e invalidación. Devuelve resultados alineados con `configs`.
 */
export function useVenuePricings(configs: { venueId: string; slot: AccountSlot }[]) {
  return useQueries({
    queries: configs.map((c) => ({
      queryKey: [...MERCHANTS_QUERY_KEY, 'venue-pricing', c.venueId, c.slot],
      queryFn: () => getActiveVenuePricing(c.venueId, c.slot),
      staleTime: 30_000,
    })),
  })
}

export function useSaveVenuePricing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      venueId: string
      accountType: AccountSlot
      activeId: string | null
      input: SaveVenuePricingInput
    }) => saveVenuePricing(vars.venueId, vars.accountType, vars.activeId, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

export function useHolidays(year: number) {
  return useQuery({
    queryKey: ['superadmin', 'holidays', year],
    queryFn: () => fetchHolidays(year),
    staleTime: 24 * 60 * 60_000,
  })
}

export function useSaveSettlement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      merchantAccountId: string
      rows: SettlementRowInput[]
      cutoffTime: string
      cutoffTimezone: string
      existingByCard: Record<string, string>
    }) =>
      saveSettlement(
        vars.merchantAccountId,
        vars.rows,
        vars.cutoffTime,
        vars.cutoffTimezone,
        vars.existingByCard,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

export function useVenueOptions() {
  return useQuery({
    queryKey: ['superadmin', 'venue-options'],
    queryFn: fetchVenueOptions,
    staleTime: 5 * 60_000,
  })
}

/** Terminales del venue (para el wizard: elegir la principal / atar extras). */
export function useVenueTerminals(venueId: string | null | undefined) {
  return useQuery({
    queryKey: ['superadmin', 'venue-terminals', venueId ?? null],
    queryFn: () => fetchVenueTerminals(venueId as string),
    enabled: !!venueId,
    staleTime: 30_000,
  })
}

export function useFullSetupBlumon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: BlumonFullSetupPayload) => fullSetupBlumon(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

export function useAngelPayAccounts(venueId: string | undefined) {
  return useQuery({
    queryKey: ['superadmin', 'angelpay-accounts', venueId ?? null],
    queryFn: () => fetchAngelPayAccounts(venueId as string),
    enabled: !!venueId,
    staleTime: 60_000,
  })
}

export function useFullSetupAngelPay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AngelPayFullSetupPayload) => fullSetupAngelPay(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

export function useAssignableTerminals(merchantId: string | undefined) {
  return useQuery({
    queryKey: [...MERCHANTS_QUERY_KEY, 'assignable-terminals', merchantId ?? null],
    queryFn: () => fetchAssignableTerminals(merchantId as string),
    enabled: !!merchantId,
    staleTime: 30_000,
  })
}

/** Anexa/quita una terminal. Invalida `MERCHANTS_QUERY_KEY` → refresca detalle, lista y candidatas. */
export function useSetTerminalServes(merchantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { terminalId: string; serves: boolean }) =>
      setTerminalServes(merchantId, vars.terminalId, vars.serves),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}
