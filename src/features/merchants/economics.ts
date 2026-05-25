/**
 * Cálculo de la economía de un merchant account, por tipo de tarjeta, sobre un
 * monto de referencia ($100). REPORT-TIME / proyección — NO toca el proceso de pago.
 *
 * 4 modos (additive, según qué datos existan):
 *   - no-pricing:   sólo costo del proveedor; no hay con qué calcular margen.
 *   - all-avoqado:  hay pricing al venue, sin MerchantRevenueShare → margen = precio − costo, todo Avoqado.
 *   - direct-split: MerchantRevenueShare con aggregatorPrice=null → 1 margen provider↔Avoqado.
 *   - aggregator:   MerchantRevenueShare con aggregatorPrice → Avoqado le cobra al agregador;
 *                   margen provider-side = aggregatorPrice − costo, split por avoqadoShareOfProviderMargin.
 *
 * El tramo agregador→venue (comisión por venue, VenueCommission) es per-venue y se
 * muestra en la sección Venues; no se promedia aquí (sería engañoso a nivel merchant).
 */
import { CARD_TYPES, type CardRates, type CardType } from './types'

export const REFERENCE_AMOUNT = 100

export type EconomicsMode = 'no-pricing' | 'all-avoqado' | 'direct-split' | 'aggregator'

export interface CardEconomics {
  amount: number
  providerCostAmount: number
  venueChargeAmount: number | null
  aggregatorPriceAmount: number | null
  avoqadoMargin: number | null
}

export interface MerchantEconomics {
  mode: EconomicsMode
  byCard: Record<CardType, CardEconomics>
}

interface RevenueShareInput {
  aggregatorPrice: CardRates | null
  avoqadoShareOfProviderMargin: number
  avoqadoShareOfAggregatorMargin: number | null
  taxRate: number
}

export interface EconomicsInput {
  cost: CardRates
  venuePrice: CardRates | null
  revenueShare: RevenueShareInput | null
}

function resolveMode(input: EconomicsInput): EconomicsMode {
  if (input.revenueShare?.aggregatorPrice) return 'aggregator'
  if (input.revenueShare) return 'direct-split'
  if (input.venuePrice) return 'all-avoqado'
  return 'no-pricing'
}

export function computeMerchantEconomics(input: EconomicsInput): MerchantEconomics {
  const mode = resolveMode(input)
  const A = REFERENCE_AMOUNT

  const byCard = {} as Record<CardType, CardEconomics>
  for (const card of CARD_TYPES) {
    const providerCostAmount = input.cost[card] * A
    let venueChargeAmount: number | null = null
    let aggregatorPriceAmount: number | null = null
    let avoqadoMargin: number | null = null

    if (mode === 'all-avoqado' && input.venuePrice) {
      venueChargeAmount = input.venuePrice[card] * A
      avoqadoMargin = venueChargeAmount - providerCostAmount
    } else if (mode === 'direct-split' && input.venuePrice && input.revenueShare) {
      venueChargeAmount = input.venuePrice[card] * A
      const pool = venueChargeAmount - providerCostAmount
      avoqadoMargin = pool * input.revenueShare.avoqadoShareOfProviderMargin
    } else if (mode === 'aggregator' && input.revenueShare?.aggregatorPrice) {
      aggregatorPriceAmount = input.revenueShare.aggregatorPrice[card] * A
      const providerMargin = aggregatorPriceAmount - providerCostAmount
      avoqadoMargin = providerMargin * input.revenueShare.avoqadoShareOfProviderMargin
    }

    byCard[card] = {
      amount: A,
      providerCostAmount,
      venueChargeAmount,
      aggregatorPriceAmount,
      avoqadoMargin,
    }
  }

  return { mode, byCard }
}
