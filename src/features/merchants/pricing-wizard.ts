/**
 * Lógica pura del Asistente de pricing. Traduce las respuestas del wizard (en
 * español plano) a los 3 payloads crudos que ya consumen las mutations
 * existentes, y arma el `MerchantEconomics` para el preview. Sin React, sin IO
 * — 100% testeable.
 */
import { CARD_TYPES, type CardRates, type CardType } from './types'
import type { SaveCostInput, SaveRevenueShareInput, SaveVenuePricingInput } from './api'
import { computeMerchantEconomics, type MerchantEconomics } from './economics'

export type ChargeModel = 'flat' | 'cost-plus' | 'aggregator'

const ZERO_RATES: CardRates = { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 }

export interface WizardState {
  // Paso 1 — costo del proveedor
  cost: CardRates
  costIncludesTax: boolean
  taxRate: number
  // Paso 2 — modelo de cobro
  model: ChargeModel
  // flat
  flatRate: number
  flatIncludesTax: boolean
  // cost-plus
  markup: number
  markupIncludesTax: boolean
  markupIsNet: boolean // sólo relevante con socio: ¿el markup es neto (limpio) o total?
  // split (flat + cost-plus)
  hasPartner: boolean
  avoqadoShare: number // 0..1 ; se ignora si !hasPartner (usa 1)
  // aggregator
  aggregatorPrice: CardRates // precio base al venue (antes de tu markup)
  aggIncludesTax: boolean
  aggShareProvider: number // tramo 1 (costo→precio base), 0..1
  aggMarkup: number // tu markup encima del precio base (tramo 2), decimal
  aggMarkupIncludesTax: boolean // ¿el markup ya es final (true) o se le suma IVA (false)?
  aggShareAggregator: number // tramo 2 (el markup), 0..1
  // destino del pricing
  venueId: string
}

export const EMPTY_WIZARD_STATE: WizardState = {
  cost: { ...ZERO_RATES },
  costIncludesTax: true,
  taxRate: 0.16,
  model: 'flat',
  flatRate: 0,
  flatIncludesTax: true,
  markup: 0,
  markupIncludesTax: true,
  markupIsNet: false,
  hasPartner: false,
  avoqadoShare: 1,
  aggregatorPrice: { ...ZERO_RATES },
  aggIncludesTax: true,
  aggShareProvider: 0.5,
  aggMarkup: 0,
  aggMarkupIncludesTax: true,
  aggShareAggregator: 1,
  venueId: '',
}

export interface WizardResult {
  costInput: SaveCostInput
  revenueShareInput: SaveRevenueShareInput
  venuePricingInput: SaveVenuePricingInput
}

const eff = (rate: number, includesTax: boolean, taxRate: number): number =>
  includesTax ? rate : rate * (1 + taxRate)

const mapRates = (fn: (card: CardType) => number): CardRates =>
  CARD_TYPES.reduce((acc, c) => ({ ...acc, [c]: fn(c) }), {} as CardRates)

/** Share efectivo de Avoqado (1 = te quedas todo si no hay socio). */
function effectiveShare(s: WizardState): number {
  return s.hasPartner ? s.avoqadoShare : 1
}

/** Modo agregador: pricing efectivo del venue = precio base efectivo + tu markup efectivo. */
function aggVenuePriceEff(s: WizardState): CardRates {
  const baseEff = mapRates((c) => eff(s.aggregatorPrice[c], s.aggIncludesTax, s.taxRate))
  const markupEff = eff(s.aggMarkup, s.aggMarkupIncludesTax, s.taxRate)
  return mapRates((c) => baseEff[c] + markupEff)
}

/** Pricing efectivo (con IVA) que paga el venue, por tarjeta, según el modelo. */
function venuePriceEff(s: WizardState): CardRates {
  const costEff = mapRates((c) => eff(s.cost[c], s.costIncludesTax, s.taxRate))
  if (s.model === 'flat') {
    return mapRates(() => eff(s.flatRate, s.flatIncludesTax, s.taxRate))
  }
  if (s.model === 'aggregator') {
    return aggVenuePriceEff(s)
  }
  // cost-plus
  const markupEff = eff(s.markup, s.markupIncludesTax, s.taxRate)
  const share = effectiveShare(s)
  const markupTotalEff = s.hasPartner && s.markupIsNet ? markupEff / share : markupEff
  return mapRates((c) => costEff[c] + markupTotalEff)
}

export function buildWizardResult(s: WizardState): WizardResult {
  const costInput: SaveCostInput = {
    rates: s.cost,
    includesTax: s.costIncludesTax,
    taxRate: s.taxRate,
  }

  if (s.model === 'aggregator') {
    return {
      costInput,
      revenueShareInput: {
        aggregatorPrice: s.aggregatorPrice,
        aggregatorPriceIncludesTax: s.aggIncludesTax,
        avoqadoShareOfProviderMargin: s.aggShareProvider,
        avoqadoShareOfAggregatorMargin: s.aggShareAggregator,
        taxRate: s.taxRate,
      },
      venuePricingInput: {
        // Pricing al venue = precio base + tu markup (calculado efectivo, ya con IVA).
        rates: aggVenuePriceEff(s),
        includesTax: true,
        taxRate: s.taxRate,
      },
    }
  }

  // flat + cost-plus → revenue share directo
  const revenueShareInput: SaveRevenueShareInput = {
    aggregatorPrice: null,
    aggregatorPriceIncludesTax: false,
    avoqadoShareOfProviderMargin: effectiveShare(s),
    avoqadoShareOfAggregatorMargin: null,
    taxRate: s.taxRate,
  }

  if (s.model === 'flat') {
    return {
      costInput,
      revenueShareInput,
      venuePricingInput: {
        rates: mapRates(() => s.flatRate),
        includesTax: s.flatIncludesTax,
        taxRate: s.taxRate,
      },
    }
  }

  // cost-plus: el pricing se guarda como CRUDO efectivo (ya con IVA) → includesTax true
  return {
    costInput,
    revenueShareInput,
    venuePricingInput: {
      rates: venuePriceEff(s),
      includesTax: true,
      taxRate: s.taxRate,
    },
  }
}

/** Economía para el preview del Paso 3 (neto real con split aplicado). */
export function wizardEconomics(s: WizardState): MerchantEconomics {
  const costEff = mapRates((c) => eff(s.cost[c], s.costIncludesTax, s.taxRate))
  if (s.model === 'aggregator') {
    return computeMerchantEconomics({
      cost: costEff,
      venuePrice: aggVenuePriceEff(s),
      revenueShare: {
        aggregatorPrice: mapRates((c) => eff(s.aggregatorPrice[c], s.aggIncludesTax, s.taxRate)),
        avoqadoShareOfProviderMargin: s.aggShareProvider,
        avoqadoShareOfAggregatorMargin: s.aggShareAggregator,
        taxRate: s.taxRate,
      },
    })
  }
  return computeMerchantEconomics({
    cost: costEff,
    venuePrice: venuePriceEff(s),
    revenueShare: {
      aggregatorPrice: null,
      avoqadoShareOfProviderMargin: effectiveShare(s),
      avoqadoShareOfAggregatorMargin: null,
      taxRate: s.taxRate,
    },
  })
}
