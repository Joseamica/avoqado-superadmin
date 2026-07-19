import { describe, it, expect } from 'vitest'
import {
  buildWizardResult,
  wizardEconomics,
  EMPTY_WIZARD_STATE,
  type WizardState,
} from './pricing-wizard'

// Costos reales del caso Berthe (base, +IVA): 1.68 / 2.05 / 3 / 3.3
const base: WizardState = {
  ...EMPTY_WIZARD_STATE,
  cost: { DEBIT: 0.0168, CREDIT: 0.0205, AMEX: 0.03, INTERNATIONAL: 0.033 },
  costIncludesTax: false,
  taxRate: 0.16,
  venueId: 'venue-1',
}

describe('buildWizardResult', () => {
  it('flat: pricing pareja, revenue share directo', () => {
    const r = buildWizardResult({
      ...base,
      model: 'flat',
      flatRate: 0.035,
      flatIncludesTax: true,
      hasPartner: false,
    })
    expect(r.venuePricingInput.rates).toEqual({
      DEBIT: 0.035,
      CREDIT: 0.035,
      AMEX: 0.035,
      INTERNATIONAL: 0.035,
    })
    expect(r.venuePricingInput.includesTax).toBe(true)
    expect(r.revenueShareInput.aggregatorPrice).toBeNull()
    expect(r.revenueShareInput.avoqadoShareOfProviderMargin).toBe(1)
    expect(r.costInput.rates).toEqual(base.cost)
    expect(r.costInput.includesTax).toBe(false)
  })

  it('cost-plus total 3.5% split 50/50: pricing = costo efectivo + 3.5%', () => {
    const r = buildWizardResult({
      ...base,
      model: 'cost-plus',
      markup: 0.035,
      markupIncludesTax: true,
      markupIsNet: false,
      hasPartner: true,
      avoqadoShare: 0.5,
    })
    // débito: 0.0168*1.16 + 0.035 = 0.054488
    expect(r.venuePricingInput.rates.DEBIT).toBeCloseTo(0.054488, 6)
    expect(r.venuePricingInput.rates.AMEX).toBeCloseTo(0.0698, 6)
    expect(r.venuePricingInput.includesTax).toBe(true)
    expect(r.revenueShareInput.avoqadoShareOfProviderMargin).toBe(0.5)
  })

  it('cost-plus limpio (isNet) split 50/50: markup total = 7%', () => {
    const r = buildWizardResult({
      ...base,
      model: 'cost-plus',
      markup: 0.035,
      markupIncludesTax: true,
      markupIsNet: true,
      hasPartner: true,
      avoqadoShare: 0.5,
    })
    // débito: 0.0168*1.16 + 0.07 = 0.089488
    expect(r.venuePricingInput.rates.DEBIT).toBeCloseTo(0.089488, 6)
  })

  it('agregador: revenue share con precio agregador + dos shares', () => {
    const r = buildWizardResult({
      ...base,
      model: 'aggregator',
      aggregatorPrice: { DEBIT: 0.025, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.035 },
      aggIncludesTax: true,
      aggShareProvider: 0.5,
      aggVenuePricing: { DEBIT: 0.035, CREDIT: 0.035, AMEX: 0.035, INTERNATIONAL: 0.035 },
      aggVenueIncludesTax: true,
      aggShareAggregator: 1,
    })
    expect(r.revenueShareInput.aggregatorPrice).toEqual({
      DEBIT: 0.025,
      CREDIT: 0.025,
      AMEX: 0.035,
      INTERNATIONAL: 0.035,
    })
    expect(r.revenueShareInput.avoqadoShareOfProviderMargin).toBe(0.5)
    expect(r.revenueShareInput.avoqadoShareOfAggregatorMargin).toBe(1)
    expect(r.venuePricingInput.rates.DEBIT).toBe(0.035)
  })
})

describe('wizardEconomics', () => {
  it('cost-plus total: neto Avoqado parejo = markup × share', () => {
    const eco = wizardEconomics({
      ...base,
      model: 'cost-plus',
      markup: 0.035,
      markupIncludesTax: true,
      markupIsNet: false,
      hasPartner: true,
      avoqadoShare: 0.5,
    })
    // pool = 3.5%, neto = 1.75% de $100 = $1.75 en toda tarjeta
    expect(eco.byCard.DEBIT.avoqadoMargin).toBeCloseTo(1.75, 2)
    expect(eco.byCard.AMEX.avoqadoMargin).toBeCloseTo(1.75, 2)
  })

  it('flat: internacional sale negativo con ese costo', () => {
    const eco = wizardEconomics({
      ...base,
      model: 'flat',
      flatRate: 0.035,
      flatIncludesTax: true,
      hasPartner: false,
    })
    // intl efectivo 3.83% > 3.5% → margen negativo
    expect(eco.byCard.INTERNATIONAL.avoqadoMargin! < 0).toBe(true)
  })
})
