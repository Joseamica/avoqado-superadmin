import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  createMerchant,
  deleteMerchant,
  fetchActiveCost,
  fetchAngelPayAccounts,
  fetchAssignableTerminals,
  fetchMerchant,
  fetchMerchants,
  fetchProviders,
  fetchRevenueShare,
  fetchSettlements,
  fetchVenueConfigs,
  fetchVenueOptions,
  fullSetupBlumon,
  getActiveVenuePricing,
  saveCost,
  saveRevenueShare,
  saveSettlement,
  saveVenuePricing,
  setTerminalServes,
  toggleMerchant,
  updateMerchant,
} from './api'

const baseURL = 'http://localhost:3000/api/v1'

const rawMerchant = {
  id: 'm1',
  provider: { id: 'pp1', code: 'BLUMON', name: 'Blumon', type: 'PAYMENT_PROCESSOR' as const },
  externalMerchantId: 'ext123',
  alias: 'Cuenta Principal',
  displayName: 'Blumon Barra',
  active: true,
  displayOrder: 1,
  clabeNumber: null,
  bankName: null,
  accountHolder: null,
  hasCredentials: true,
  blumonSerialNumber: '1850072345',
  blumonPosId: 'pos1',
  blumonEnvironment: 'PRODUCTION',
  blumonMerchantId: 'bm1',
  angelpayAffiliation: null,
  angelpayMerchantName: null,
  aggregatorId: null,
  venues: [{ id: 'v1', name: 'Pez Volador', slug: 'pez-volador' }],
  terminals: [{ id: 't1', serialNumber: '123' }],
  _count: { costStructures: 1, venueConfigs: 1, terminals: 2 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-05-20T00:00:00.000Z',
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchMerchants', () => {
  it('mapea raw response correctamente', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts`, () =>
        HttpResponse.json({ success: true, data: [rawMerchant], count: 1 }),
      ),
    )
    const result = await fetchMerchants()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'm1',
      provider: { code: 'BLUMON' },
      active: true,
      counts: { costStructures: 1, venueConfigs: 1, terminals: 2 },
    })
  })

  it('devuelve [] cuando data no es array', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts`, () =>
        HttpResponse.json({ success: true }),
      ),
    )
    expect(await fetchMerchants()).toEqual([])
  })
})

describe('fetchMerchant', () => {
  it('devuelve merchant mapeado', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts/m1`, () =>
        HttpResponse.json({ data: rawMerchant }),
      ),
    )
    const result = await fetchMerchant('m1')
    expect(result?.id).toBe('m1')
  })

  it('devuelve null en 404', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts/missing`, () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 }),
      ),
    )
    expect(await fetchMerchant('missing')).toBeNull()
  })
})

describe('fetchProviders', () => {
  it('devuelve lista de providers', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers`, () =>
        HttpResponse.json({
          data: [{ id: 'pp1', code: 'BLUMON', name: 'Blumon', type: 'PAYMENT_PROCESSOR' }],
        }),
      ),
    )
    const result = await fetchProviders()
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('BLUMON')
  })
})

describe('fetchActiveCost', () => {
  it('mapea Decimal strings a numbers', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/cost-structures/active/m1`, () =>
        HttpResponse.json({
          data: {
            id: 'cs1',
            debitRate: '1.65',
            creditRate: '2.50',
            amexRate: '3.00',
            internationalRate: '3.50',
            includesTax: true,
            taxRate: '0.16',
            fixedCostPerTransaction: null,
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
            active: true,
          },
        }),
      ),
    )
    const result = await fetchActiveCost('m1')
    expect(result).not.toBeNull()
    expect(result!.debitRate).toBe(1.65)
    expect(result!.creditRate).toBe(2.5)
    expect(result!.includesTax).toBe(true)
  })

  it('devuelve null en 404', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/cost-structures/active/missing`, () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    )
    expect(await fetchActiveCost('missing')).toBeNull()
  })
})

describe('fetchRevenueShare', () => {
  it('mapea aggregatorPrice y porcentajes', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-revenue-shares/by-merchant`, () =>
        HttpResponse.json({
          data: {
            id: 'rs1',
            aggregatorPrice: { DEBIT: '1.0', CREDIT: '2.0', AMEX: '3.0', INTERNATIONAL: '4.0' },
            aggregatorPriceIncludesTax: false,
            avoqadoShareOfProviderMargin: '0.50',
            avoqadoShareOfAggregatorMargin: null,
            taxRate: '0.16',
            active: true,
          },
        }),
      ),
    )
    const result = await fetchRevenueShare('m1')
    expect(result).not.toBeNull()
    expect(result!.aggregatorPrice!.DEBIT).toBe(1.0)
    expect(result!.avoqadoShareOfProviderMargin).toBe(0.5)
  })

  it('devuelve null cuando data es null', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-revenue-shares/by-merchant`, () =>
        HttpResponse.json({ data: null }),
      ),
    )
    expect(await fetchRevenueShare('m1')).toBeNull()
  })
})

describe('fetchSettlements', () => {
  it('mapea lista de settlement configs', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/settlement-configurations`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'sc1',
              cardType: 'DEBIT',
              settlementDays: '2',
              settlementDayType: 'BUSINESS_DAYS',
              cutoffTime: '15:00',
              cutoffTimezone: 'America/Mexico_City',
              effectiveFrom: '2026-01-01',
              effectiveTo: null,
            },
          ],
        }),
      ),
    )
    const result = await fetchSettlements('m1')
    expect(result).toHaveLength(1)
    expect(result[0].settlementDays).toBe(2)
  })
})

describe('fetchVenueConfigs', () => {
  it('mapea venues y detecta slot', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/venue-pricing/configs-by-merchant/m1`, () =>
        HttpResponse.json({
          data: [{ primaryAccountId: 'm1', venue: { id: 'v1', name: 'Pez', slug: 'pez' } }],
        }),
      ),
    )
    const result = await fetchVenueConfigs('m1')
    expect(result[0].slot).toBe('PRIMARY')
  })
})

describe('createMerchant', () => {
  it('crea y devuelve merchant mapeado', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/merchant-accounts`, () =>
        HttpResponse.json({ data: rawMerchant }),
      ),
    )
    const result = await createMerchant({ providerId: 'pp1', externalMerchantId: 'ext123' })
    expect(result.id).toBe('m1')
  })
})

describe('updateMerchant', () => {
  it('actualiza y devuelve merchant', async () => {
    server.use(
      http.put(`${baseURL}/superadmin/merchant-accounts/m1`, () =>
        HttpResponse.json({ data: { ...rawMerchant, alias: 'Nuevo Alias' } }),
      ),
    )
    const result = await updateMerchant('m1', { alias: 'Nuevo Alias' })
    expect(result.alias).toBe('Nuevo Alias')
  })
})

describe('toggleMerchant', () => {
  it('toggle y devuelve merchant', async () => {
    server.use(
      http.patch(`${baseURL}/superadmin/merchant-accounts/m1/toggle`, () =>
        HttpResponse.json({ data: { ...rawMerchant, active: false } }),
      ),
    )
    const result = await toggleMerchant('m1')
    expect(result.active).toBe(false)
  })
})

describe('deleteMerchant', () => {
  it('resuelve sin valor', async () => {
    server.use(
      http.delete(`${baseURL}/superadmin/merchant-accounts/m1`, () => HttpResponse.json({})),
    )
    await expect(deleteMerchant('m1')).resolves.toBeUndefined()
  })
})

describe('setTerminalServes', () => {
  it('manda PUT con serves flag', async () => {
    server.use(
      http.put(`${baseURL}/superadmin/merchant-accounts/m1/terminals/t1`, () =>
        HttpResponse.json({}),
      ),
    )
    await expect(setTerminalServes('m1', 't1', true)).resolves.toBeUndefined()
  })
})

describe('fetchAssignableTerminals', () => {
  it('devuelve lista de terminales', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts/m1/assignable-terminals`, () =>
        HttpResponse.json({ data: [{ id: 't2', serialNumber: '456', name: 'TPV 2' }] }),
      ),
    )
    const result = await fetchAssignableTerminals('m1')
    expect(result).toHaveLength(1)
  })
})

describe('saveCost', () => {
  it('POST cuando no hay activeId', async () => {
    let called = false
    server.use(
      http.post(`${baseURL}/superadmin/cost-structures`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )
    await saveCost('m1', null, {
      rates: { DEBIT: 1.65, CREDIT: 2.5, AMEX: 3.0, INTERNATIONAL: 3.5 },
      includesTax: true,
      taxRate: 0.16,
    })
    expect(called).toBe(true)
  })

  it('PUT cuando hay activeId', async () => {
    let called = false
    server.use(
      http.put(`${baseURL}/superadmin/cost-structures/cs1`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )
    await saveCost('m1', 'cs1', {
      rates: { DEBIT: 1.65, CREDIT: 2.5, AMEX: 3.0, INTERNATIONAL: 3.5 },
      includesTax: true,
      taxRate: 0.16,
    })
    expect(called).toBe(true)
  })
})

describe('saveRevenueShare', () => {
  it('POST cuando no hay existingId', async () => {
    let called = false
    server.use(
      http.post(`${baseURL}/superadmin/merchant-revenue-shares`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )
    await saveRevenueShare('m1', null, {
      aggregatorPrice: null,
      aggregatorPriceIncludesTax: false,
      avoqadoShareOfProviderMargin: 0.5,
      avoqadoShareOfAggregatorMargin: null,
      taxRate: 0.16,
    })
    expect(called).toBe(true)
  })
})

describe('getActiveVenuePricing', () => {
  it('mapea venue pricing', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/venue-pricing/structures/active/v1/PRIMARY`, () =>
        HttpResponse.json({
          data: {
            id: 'vp1',
            debitRate: '2.0',
            creditRate: '3.0',
            amexRate: '4.0',
            internationalRate: '5.0',
            includesTax: true,
            taxRate: '0.16',
            fixedFeePerTransaction: null,
            monthlyServiceFee: null,
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
            active: true,
          },
        }),
      ),
    )
    const result = await getActiveVenuePricing('v1', 'PRIMARY')
    expect(result).not.toBeNull()
    expect(result!.debitRate).toBe(2.0)
  })

  it('devuelve null en 404', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/venue-pricing/structures/active/v1/PRIMARY`, () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    )
    expect(await getActiveVenuePricing('v1', 'PRIMARY')).toBeNull()
  })
})

describe('saveVenuePricing', () => {
  it('POST cuando no hay activeId', async () => {
    let called = false
    server.use(
      http.post(`${baseURL}/superadmin/venue-pricing/structures`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )
    await saveVenuePricing('v1', 'PRIMARY', null, {
      rates: { DEBIT: 2.0, CREDIT: 3.0, AMEX: 4.0, INTERNATIONAL: 5.0 },
      includesTax: true,
      taxRate: 0.16,
    })
    expect(called).toBe(true)
  })
})

describe('fullSetupBlumon', () => {
  it('crea merchant con setup completo', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/merchant-accounts/blumon/full-setup`, () =>
        HttpResponse.json({ data: rawMerchant }),
      ),
    )
    const result = await fullSetupBlumon({
      serialNumber: '1850072345',
      brand: 'PAX',
      model: 'A910s',
      environment: 'PRODUCTION',
      target: { type: 'venue', id: 'v1' },
      accountSlot: 'PRIMARY',
    })
    expect(result.id).toBe('m1')
  })
})

describe('fetchVenueOptions', () => {
  it('devuelve lista de venues', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues`, () =>
        HttpResponse.json({ data: [{ id: 'v1', name: 'Pez', slug: 'pez' }] }),
      ),
    )
    const result = await fetchVenueOptions()
    expect(result).toHaveLength(1)
  })
})

describe('fetchAngelPayAccounts', () => {
  it('devuelve lista de cuentas AngelPay', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/venues/v1/angelpay-accounts`, () =>
        HttpResponse.json({
          data: [{ id: 'ap1', email: 'a@b.com', status: 'ACTIVE', environment: 'PROD' }],
        }),
      ),
    )
    const result = await fetchAngelPayAccounts('v1')
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('a@b.com')
  })
})

describe('saveSettlement', () => {
  it('POST cuando no hay existente para el cardType', async () => {
    let called = false
    server.use(
      http.post(`${baseURL}/superadmin/settlement-configurations`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )
    await saveSettlement(
      'm1',
      [{ cardType: 'DEBIT', settlementDays: 2, settlementDayType: 'BUSINESS_DAYS' }],
      '15:00',
      'America/Mexico_City',
      {},
    )
    expect(called).toBe(true)
  })

  it('PUT cuando hay ID existente', async () => {
    let called = false
    server.use(
      http.put(`${baseURL}/superadmin/settlement-configurations/sc1`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )
    await saveSettlement(
      'm1',
      [{ cardType: 'DEBIT', settlementDays: 2, settlementDayType: 'BUSINESS_DAYS' }],
      '15:00',
      'America/Mexico_City',
      { DEBIT: 'sc1' },
    )
    expect(called).toBe(true)
  })
})
