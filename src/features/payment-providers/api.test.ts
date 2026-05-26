import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  createPaymentProvider,
  deleteCostStructure,
  deleteEcommerceMerchant,
  deleteMerchantAccount,
  deletePaymentProvider,
  detachTerminalFromMerchant,
  fetchMerchantBlockers,
  fetchPaymentProvider,
  fetchPaymentProviders,
  fetchProviderBlockers,
  forceDeletePaymentProvider,
  togglePaymentProvider,
  updatePaymentProvider,
} from './api'

const baseURL = 'http://localhost:3000/api/v1'

const rawProvider = {
  id: 'pp1',
  code: 'BLUMON',
  name: 'Blumon PAX Payment Solutions',
  type: 'PAYMENT_PROCESSOR' as const,
  countryCode: ['MX'],
  active: true,
  configSchema: { required: ['serialNumber'] },
  _count: { merchants: 5, costStructures: 2 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-05-20T12:00:00.000Z',
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchPaymentProviders', () => {
  it('mapea la raw response correctamente', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers`, () =>
        HttpResponse.json({ success: true, data: [rawProvider] }),
      ),
    )

    const result = await fetchPaymentProviders()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'pp1',
      code: 'BLUMON',
      name: 'Blumon PAX Payment Solutions',
      type: 'PAYMENT_PROCESSOR',
      countryCode: ['MX'],
      active: true,
      merchantsCount: 5,
      costStructuresCount: 2,
    })
  })

  it('devuelve [] cuando data no es array', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers`, () =>
        HttpResponse.json({ success: true }),
      ),
    )

    const result = await fetchPaymentProviders()
    expect(result).toEqual([])
  })

  it('forwarda params como query string', async () => {
    let receivedUrl: URL | null = null
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers`, ({ request }) => {
        receivedUrl = new URL(request.url)
        return HttpResponse.json({ success: true, data: [] })
      }),
    )

    await fetchPaymentProviders({ type: 'GATEWAY', active: true })
    expect(receivedUrl).not.toBeNull()
    expect(receivedUrl!.searchParams.get('type')).toBe('GATEWAY')
    expect(receivedUrl!.searchParams.get('active')).toBe('true')
  })

  it('mapea countryCode a [] cuando viene undefined', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers`, () =>
        HttpResponse.json({
          success: true,
          data: [{ ...rawProvider, countryCode: undefined }],
        }),
      ),
    )

    const result = await fetchPaymentProviders()
    expect(result[0].countryCode).toEqual([])
  })
})

describe('fetchPaymentProvider', () => {
  it('devuelve el provider mapeado cuando existe', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers/pp1`, () =>
        HttpResponse.json({ success: true, data: rawProvider }),
      ),
    )

    const result = await fetchPaymentProvider('pp1')
    expect(result?.id).toBe('pp1')
    expect(result?.code).toBe('BLUMON')
  })

  it('devuelve null en 404', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers/missing`, () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 }),
      ),
    )

    const result = await fetchPaymentProvider('missing')
    expect(result).toBeNull()
  })

  it('devuelve null si data viene vacío', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers/empty`, () => HttpResponse.json({})),
    )

    const result = await fetchPaymentProvider('empty')
    expect(result).toBeNull()
  })

  it('throwea cuando el error NO es 404', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers/bad`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )

    await expect(fetchPaymentProvider('bad')).rejects.toThrow()
  })
})

describe('createPaymentProvider', () => {
  it('manda POST y devuelve el provider creado', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/payment-providers`, () =>
        HttpResponse.json({ success: true, data: rawProvider }),
      ),
    )

    const result = await createPaymentProvider({
      code: 'BLUMON',
      name: 'Blumon PAX Payment Solutions',
      type: 'PAYMENT_PROCESSOR',
      countryCode: ['MX'],
    })
    expect(result.id).toBe('pp1')
  })

  it('throwea cuando el server devuelve respuesta vacía', async () => {
    server.use(http.post(`${baseURL}/superadmin/payment-providers`, () => HttpResponse.json({})))

    await expect(
      createPaymentProvider({
        code: 'X',
        name: 'X',
        type: 'OTHER',
        countryCode: [],
      }),
    ).rejects.toThrow('empty response')
  })
})

describe('updatePaymentProvider', () => {
  it('manda PUT con el payload y devuelve provider actualizado', async () => {
    server.use(
      http.put(`${baseURL}/superadmin/payment-providers/pp1`, () =>
        HttpResponse.json({ success: true, data: { ...rawProvider, name: 'Blumon v2' } }),
      ),
    )

    const result = await updatePaymentProvider('pp1', { name: 'Blumon v2' })
    expect(result.name).toBe('Blumon v2')
  })

  it('throwea cuando el server devuelve respuesta vacía', async () => {
    server.use(http.put(`${baseURL}/superadmin/payment-providers/pp1`, () => HttpResponse.json({})))

    await expect(updatePaymentProvider('pp1', { name: 'X' })).rejects.toThrow('empty response')
  })
})

describe('togglePaymentProvider', () => {
  it('manda PATCH al endpoint de toggle y devuelve provider', async () => {
    server.use(
      http.patch(`${baseURL}/superadmin/payment-providers/pp1/toggle`, () =>
        HttpResponse.json({ success: true, data: { ...rawProvider, active: false } }),
      ),
    )

    const result = await togglePaymentProvider('pp1')
    expect(result.active).toBe(false)
  })

  it('throwea con respuesta vacía', async () => {
    server.use(
      http.patch(`${baseURL}/superadmin/payment-providers/pp1/toggle`, () => HttpResponse.json({})),
    )

    await expect(togglePaymentProvider('pp1')).rejects.toThrow('empty response')
  })
})

describe('deletePaymentProvider', () => {
  it('hace DELETE y resuelve', async () => {
    let called = false
    server.use(
      http.delete(`${baseURL}/superadmin/payment-providers/pp1`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )

    await expect(deletePaymentProvider('pp1')).resolves.toBeUndefined()
    expect(called).toBe(true)
  })
})

describe('fetchProviderBlockers', () => {
  it('devuelve los bloqueadores del provider', async () => {
    const blockers = {
      code: 'BLUMON',
      name: 'Blumon',
      merchants: [{ id: 'm1', label: 'Cuenta Principal' }],
      ecommerceMerchants: [],
      webhooks: 0,
      eventLogs: 42,
      costStructures: 1,
      canDelete: false,
    }
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers/pp1/blockers`, () =>
        HttpResponse.json({ success: true, data: blockers }),
      ),
    )

    const result = await fetchProviderBlockers('pp1')
    expect(result.code).toBe('BLUMON')
    expect(result.canDelete).toBe(false)
    expect(result.merchants).toHaveLength(1)
  })

  it('throwea con respuesta vacía', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers/pp1/blockers`, () => HttpResponse.json({})),
    )

    await expect(fetchProviderBlockers('pp1')).rejects.toThrow('empty response')
  })
})

describe('forceDeletePaymentProvider', () => {
  it('hace DELETE con force=true', async () => {
    let receivedUrl: URL | null = null
    server.use(
      http.delete(`${baseURL}/superadmin/payment-providers/pp1`, ({ request }) => {
        receivedUrl = new URL(request.url)
        return HttpResponse.json({})
      }),
    )

    await forceDeletePaymentProvider('pp1')
    expect(receivedUrl!.searchParams.get('force')).toBe('true')
  })
})

describe('deleteMerchantAccount', () => {
  it('hace DELETE al endpoint de merchant-accounts', async () => {
    let called = false
    server.use(
      http.delete(`${baseURL}/superadmin/merchant-accounts/m1`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )

    await expect(deleteMerchantAccount('m1')).resolves.toBeUndefined()
    expect(called).toBe(true)
  })
})

describe('deleteEcommerceMerchant', () => {
  it('hace DELETE al endpoint de ecommerce-merchants', async () => {
    let called = false
    server.use(
      http.delete(`${baseURL}/dashboard/superadmin/ecommerce-merchants/em1`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )

    await expect(deleteEcommerceMerchant('em1')).resolves.toBeUndefined()
    expect(called).toBe(true)
  })
})

describe('fetchMerchantBlockers', () => {
  it('devuelve los bloqueadores del merchant', async () => {
    const blockers = {
      displayName: 'Cuenta Principal',
      payments: 120,
      transactionCosts: 45,
      costStructures: [{ id: 'cs1' }],
      venueConfigs: [{ venueId: 'v1', venueName: 'Pez Volador', slot: 'PRIMARY' as const }],
      terminals: [{ id: 't1', name: 'TPV Barra', serialNumber: '123' }],
      canDelete: false,
    }
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts/m1/blockers`, () =>
        HttpResponse.json({ success: true, data: blockers }),
      ),
    )

    const result = await fetchMerchantBlockers('m1')
    expect(result.displayName).toBe('Cuenta Principal')
    expect(result.canDelete).toBe(false)
    expect(result.terminals).toHaveLength(1)
  })
})

describe('detachTerminalFromMerchant', () => {
  it('manda PUT con serves: false', async () => {
    let called = false
    server.use(
      http.put(`${baseURL}/superadmin/merchant-accounts/m1/terminals/t1`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )

    await expect(detachTerminalFromMerchant('m1', 't1')).resolves.toBeUndefined()
    expect(called).toBe(true)
  })
})

describe('deleteCostStructure', () => {
  it('hace DELETE al endpoint de cost-structures', async () => {
    let called = false
    server.use(
      http.delete(`${baseURL}/superadmin/cost-structures/cs1`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )

    await expect(deleteCostStructure('cs1')).resolves.toBeUndefined()
    expect(called).toBe(true)
  })
})
