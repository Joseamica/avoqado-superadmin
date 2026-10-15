import { describe, expect, it } from 'vitest'
import { computeMerchantEconomics } from './economics'
import { initRevenueShareDraft, revenueShareToInput } from './revenue-share'
import { buildWizardResult, EMPTY_WIZARD_STATE, wizardEconomics } from './pricing-wizard'

const rates = (n: number) => ({ DEBIT: n, CREDIT: n, AMEX: n, INTERNATIONAL: n })
const share = {
  aggregatorPrice: rates(0.007 * 1.16),
  avoqadoShareOfProviderMargin: 0.5,
  avoqadoShareOfAggregatorMargin: 1,
  taxRate: 0.16,
  intermediaryFeeRate: 0.01,
}

describe('manejo del intermediario', () => {
  it.each([0.5, 1])('preserva el reparto proveedor %s después del manejo', (fraction) => {
    const result = computeMerchantEconomics({
      cost: rates(0.0064 * 1.16),
      venuePrice: rates(0.055),
      revenueShare: { ...share, avoqadoShareOfProviderMargin: fraction },
    }).byCard.DEBIT
    expect(result).toMatchObject({ intermediaryReceivedAmount: expect.closeTo(99.188, 8) })
    expect(result).toMatchObject({ intermediaryFeeAmount: expect.closeTo(0.99188, 8) })
    expect(result.avoqadoMarginAggregator).toBeCloseTo(3.69612, 8)
    expect(result.avoqadoMarginProvider).toBeCloseTo(fraction === 0.5 ? 0.0348 : 0.0696, 8)
    expect(result.venueChargeAmount).toBe(5.5)
  })

  it('calcula el manejo aunque aún no se conozca el pricing del negocio', () => {
    const result = computeMerchantEconomics({
      cost: rates(0.007424),
      venuePrice: null,
      revenueShare: share,
    })
    expect(result.byCard.DEBIT).toMatchObject({ intermediaryFeeAmount: expect.closeTo(0.99188, 8) })
    expect(result.byCard.DEBIT.avoqadoMarginAggregator).toBeNull()
  })

  it('reparte el margen del agregador después de pagar el manejo', () => {
    const result = computeMerchantEconomics({
      cost: rates(0.007424),
      venuePrice: rates(0.055),
      revenueShare: { ...share, avoqadoShareOfAggregatorMargin: 0.5 },
    })
    expect(result.byCard.DEBIT.avoqadoMarginAggregator).toBeCloseTo(1.84806, 8)
  })

  it('conserva el cargo al editar y lo limpia al elegir venta directa', () => {
    const draft = {
      ...initRevenueShareDraft(null),
      mode: 'aggregator' as const,
      aggregatorPrice: rates(0.007),
      intermediaryFeeRate: 0.01,
    }
    expect(revenueShareToInput(draft)).toMatchObject({ intermediaryFeeRate: 0.01 })
    expect(revenueShareToInput({ ...draft, mode: 'direct' })).toMatchObject({
      intermediaryFeeRate: 0,
    })
  })

  it('el asistente conserva el manejo sin sumarlo a la tarifa del procesador', () => {
    const state = {
      ...EMPTY_WIZARD_STATE,
      model: 'aggregator' as const,
      cost: rates(0.0064),
      costIncludesTax: false,
      aggregatorPrice: rates(0.007),
      aggIncludesTax: false,
      aggMarkup: 0.04688,
      intermediaryFeeRate: 0.01,
    }
    expect(buildWizardResult(state).revenueShareInput).toMatchObject({
      aggregatorPrice: rates(0.007),
      intermediaryFeeRate: 0.01,
    })
    expect(wizardEconomics(state).byCard.DEBIT.avoqadoMarginAggregator).toBeCloseTo(3.69612, 8)
    expect(
      buildWizardResult({ ...state, model: 'flat' }).revenueShareInput.intermediaryFeeRate,
    ).toBe(0)
  })
})
