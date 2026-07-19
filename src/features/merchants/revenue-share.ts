/**
 * Estado de captura del revenue-share, compartido entre el editor del detalle
 * (`EditEconomicsDrawer`) y el wizard de alta Blumon (`RevenueShareDrawer`).
 * Vive en un `.ts` plano para no disparar react-refresh sobre los `.tsx`.
 */
import type { CardRates, MerchantRevenueShare } from './types'
import type { SaveRevenueShareInput } from './api'

const ZERO_RATES: CardRates = { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 }

export const DEFAULT_TAX_RATE = 0.16

export interface RevenueShareDraft {
  mode: 'direct' | 'aggregator'
  /** Precio al agregador (CRUDO; el checkbox decide el IVA). Sólo aplica en modo agregador. */
  aggregatorPrice: CardRates
  aggIncludesTax: boolean
  /** % que se queda Avoqado del margen del proveedor. Decimal 0..1. */
  shareProvider: number
  /** % que se queda Avoqado del margen del agregador. Decimal 0..1. Sólo en modo agregador. */
  shareAgg: number
}

/** Semilla desde un `MerchantRevenueShare` existente (o defaults si no hay). */
export function initRevenueShareDraft(rs: MerchantRevenueShare | null): RevenueShareDraft {
  return {
    mode: rs?.aggregatorPrice ? 'aggregator' : 'direct',
    aggregatorPrice: rs?.aggregatorPrice ?? ZERO_RATES,
    aggIncludesTax: rs?.aggregatorPriceIncludesTax ?? true,
    shareProvider: rs?.avoqadoShareOfProviderMargin ?? 0.5,
    shareAgg: rs?.avoqadoShareOfAggregatorMargin ?? 0.7,
  }
}

/** Default para una cuenta nueva (modo directa, 50% del margen proveedor). */
export const DEFAULT_REVENUE_SHARE_DRAFT: RevenueShareDraft = initRevenueShareDraft(null)

/** Convierte el draft al body que consume `saveRevenueShare`. */
export function revenueShareToInput(
  d: RevenueShareDraft,
  taxRate: number = DEFAULT_TAX_RATE,
): SaveRevenueShareInput {
  return {
    aggregatorPrice: d.mode === 'aggregator' ? d.aggregatorPrice : null,
    aggregatorPriceIncludesTax: d.aggIncludesTax,
    avoqadoShareOfProviderMargin: d.shareProvider,
    avoqadoShareOfAggregatorMargin: d.mode === 'aggregator' ? d.shareAgg : null,
    taxRate,
  }
}

/** Draft desde el body que produce el Asistente de pricing (para prellenar el editor). */
export function draftFromInput(input: SaveRevenueShareInput): RevenueShareDraft {
  return {
    mode: input.aggregatorPrice ? 'aggregator' : 'direct',
    aggregatorPrice: input.aggregatorPrice ?? ZERO_RATES,
    aggIncludesTax: input.aggregatorPriceIncludesTax,
    shareProvider: input.avoqadoShareOfProviderMargin,
    shareAgg: input.avoqadoShareOfAggregatorMargin ?? 0.7,
  }
}
