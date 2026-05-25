import { describe, it, expect } from 'vitest'
import { buildAngelPayPayload, INITIAL_ANGELPAY_DRAFT } from './angelpay-setup'

describe('buildAngelPayPayload', () => {
  it('login nuevo + merchant create + cost en DECIMAL (sin ×100)', () => {
    const body = buildAngelPayPayload({
      ...INITIAL_ANGELPAY_DRAFT,
      venueId: 'v1',
      email: 'a@b.com',
      pin: '123456',
      externalMerchantId: '9814275',
      merchantName: 'X',
      affiliation: '9814',
      displayName: 'Cuenta',
      cost: { DEBIT: 0.025, CREDIT: 0.03, AMEX: 0.035, INTERNATIONAL: 0.04 },
    })
    expect(body.cost?.debitRate).toBe(0.025) // DECIMAL, no 2.5
    expect(body.cost?.effectiveFrom).toBeTruthy()
    expect(body.login).toEqual({ mode: 'new', email: 'a@b.com', pin: '123456', environment: 'QA' })
    expect(body.merchant).toMatchObject({ mode: 'create', externalMerchantId: '9814275' })
    expect(body.slot).toEqual({ accountType: 'PRIMARY', mode: 'fill' })
    expect(body.settlement?.settlementDaysByCard?.AMEX).toBe(3)
  })
  it('login existente', () => {
    const body = buildAngelPayPayload({
      ...INITIAL_ANGELPAY_DRAFT,
      venueId: 'v1',
      loginMode: 'existing',
      angelpayUserAccountId: 'acc1',
      displayName: 'C',
      externalMerchantId: '1',
      merchantName: 'm',
      affiliation: 'a',
    })
    expect(body.login).toEqual({ mode: 'existing', angelpayUserAccountId: 'acc1' })
  })
})
