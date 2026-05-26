import { describe, it, expect } from 'vitest'
import { computeMerchantEconomics, REFERENCE_AMOUNT } from './economics'
import type { CardRates } from './types'

const cost: CardRates = { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 }
const price: CardRates = { DEBIT: 0.02, CREDIT: 0.03, AMEX: 0.04, INTERNATIONAL: 0.045 }

describe('computeMerchantEconomics', () => {
  it('REFERENCE_AMOUNT es 100', () => {
    expect(REFERENCE_AMOUNT).toBe(100)
  })

  it('modo no-pricing: sin pricing y sin revenue-share → no calcula margen', () => {
    const r = computeMerchantEconomics({ cost, venuePrice: null, revenueShare: null })
    expect(r.mode).toBe('no-pricing')
    expect(r.byCard.DEBIT.avoqadoMargin).toBeNull()
    expect(r.byCard.DEBIT.providerCostAmount).toBeCloseTo(1.5, 4)
  })

  it('modo all-avoqado: pricing presente, sin revenue-share → margen entero a Avoqado', () => {
    const r = computeMerchantEconomics({ cost, venuePrice: price, revenueShare: null })
    expect(r.mode).toBe('all-avoqado')
    expect(r.byCard.DEBIT.venueChargeAmount).toBeCloseTo(2.0, 4)
    expect(r.byCard.DEBIT.providerCostAmount).toBeCloseTo(1.5, 4)
    expect(r.byCard.DEBIT.avoqadoMargin).toBeCloseTo(0.5, 4)
  })

  it('modo direct-split: revenue-share sin agregador → margen partido provider↔Avoqado', () => {
    const r = computeMerchantEconomics({
      cost,
      venuePrice: price,
      revenueShare: {
        aggregatorPrice: null,
        avoqadoShareOfProviderMargin: 0.5,
        avoqadoShareOfAggregatorMargin: null,
        taxRate: 0.16,
      },
    })
    expect(r.mode).toBe('direct-split')
    expect(r.byCard.DEBIT.avoqadoMargin).toBeCloseTo(0.25, 4)
  })

  it('modo aggregator: aggregatorPrice presente → margen provider-side de Avoqado', () => {
    const aggregatorPrice: CardRates = {
      DEBIT: 0.02,
      CREDIT: 0.03,
      AMEX: 0.04,
      INTERNATIONAL: 0.045,
    }
    const r = computeMerchantEconomics({
      cost,
      venuePrice: null,
      revenueShare: {
        aggregatorPrice,
        avoqadoShareOfProviderMargin: 0.7,
        avoqadoShareOfAggregatorMargin: 0.7,
        taxRate: 0.16,
      },
    })
    expect(r.mode).toBe('aggregator')
    expect(r.byCard.DEBIT.avoqadoMargin).toBeCloseTo(0.35, 4)
    expect(r.byCard.DEBIT.aggregatorPriceAmount).toBeCloseTo(2.0, 4)
    // Sin venuePrice (nivel merchant) → el tramo agregador→venue no se puede calcular.
    expect(r.byCard.DEBIT.avoqadoMarginAggregator).toBeNull()
    expect(r.byCard.DEBIT.avoqadoMarginProvider).toBeCloseTo(0.35, 4)
  })

  it('modo aggregator + venuePrice (por venue) → suma tramo proveedor + tramo agregador', () => {
    const aggregatorPrice: CardRates = {
      DEBIT: 0.02,
      CREDIT: 0.03,
      AMEX: 0.04,
      INTERNATIONAL: 0.045,
    }
    // venue paga 3% débito; agregador cobra 2%; costo 1.5%.
    const venuePrice: CardRates = { DEBIT: 0.03, CREDIT: 0.05, AMEX: 0.06, INTERNATIONAL: 0.07 }
    const r = computeMerchantEconomics({
      cost,
      venuePrice,
      revenueShare: {
        aggregatorPrice,
        avoqadoShareOfProviderMargin: 0.5, // 50% del margen proveedor→agregador
        avoqadoShareOfAggregatorMargin: 1, // 100% del margen agregador→venue
        taxRate: 0.16,
      },
    })
    expect(r.mode).toBe('aggregator')
    const d = r.byCard.DEBIT
    // m1 = (2.0 - 1.5) = 0.5 → ×0.5 = 0.25
    expect(d.avoqadoMarginProvider).toBeCloseTo(0.25, 4)
    // m2 = (3.0 - 2.0) = 1.0 → ×1.0 = 1.0
    expect(d.avoqadoMarginAggregator).toBeCloseTo(1.0, 4)
    // total = 0.25 + 1.0 = 1.25
    expect(d.avoqadoMargin).toBeCloseTo(1.25, 4)
    expect(d.venueChargeAmount).toBeCloseTo(3.0, 4)
    expect(d.aggregatorPriceAmount).toBeCloseTo(2.0, 4)
  })
})
