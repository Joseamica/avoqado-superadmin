import { describe, it, expect } from 'vitest'
import {
  DEFAULT_REVENUE_SHARE_DRAFT,
  initRevenueShareDraft,
  revenueShareToInput,
  type RevenueShareDraft,
} from './revenue-share'
import type { MerchantRevenueShare } from './types'

const PRICE = { DEBIT: 0.01, CREDIT: 0.02, AMEX: 0.03, INTERNATIONAL: 0.04 }

describe('revenueShareToInput', () => {
  it('modo directa omite precio y share del agregador', () => {
    const draft: RevenueShareDraft = {
      mode: 'direct',
      aggregatorPrice: PRICE,
      aggIncludesTax: true,
      shareProvider: 0.5,
      shareAgg: 0.7,
    }
    const out = revenueShareToInput(draft)
    expect(out.aggregatorPrice).toBeNull()
    expect(out.avoqadoShareOfAggregatorMargin).toBeNull()
    expect(out.avoqadoShareOfProviderMargin).toBe(0.5)
  })

  it('modo agregador incluye precio y share del agregador', () => {
    const draft: RevenueShareDraft = {
      mode: 'aggregator',
      aggregatorPrice: PRICE,
      aggIncludesTax: false,
      shareProvider: 0.5,
      shareAgg: 0.7,
    }
    const out = revenueShareToInput(draft, 0.16)
    expect(out.aggregatorPrice).toEqual(PRICE)
    expect(out.aggregatorPriceIncludesTax).toBe(false)
    expect(out.avoqadoShareOfAggregatorMargin).toBe(0.7)
    expect(out.taxRate).toBe(0.16)
  })
})

describe('initRevenueShareDraft', () => {
  it('null → default directa 50%', () => {
    expect(DEFAULT_REVENUE_SHARE_DRAFT.mode).toBe('direct')
    expect(DEFAULT_REVENUE_SHARE_DRAFT.shareProvider).toBe(0.5)
  })

  it('un RS con aggregatorPrice arranca en modo agregador', () => {
    const rs: MerchantRevenueShare = {
      id: 'rs1',
      merchantAccountId: 'm1',
      aggregatorPrice: PRICE,
      aggregatorPriceIncludesTax: true,
      avoqadoShareOfProviderMargin: 0.5,
      avoqadoShareOfAggregatorMargin: 0.6,
      taxRate: 0.16,
      active: true,
    }
    const draft = initRevenueShareDraft(rs)
    expect(draft.mode).toBe('aggregator')
    expect(draft.shareAgg).toBe(0.6)
  })
})
