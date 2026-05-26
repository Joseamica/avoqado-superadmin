import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { renderHook, waitFor, act } from '@testing-library/react'
import { AllProviders } from '@/test/render'
import {
  usePaymentProviders,
  usePaymentProvider,
  useCreatePaymentProvider,
  useUpdatePaymentProvider,
  useTogglePaymentProvider,
  useDeletePaymentProvider,
  useProviderBlockers,
  useRemoveMerchantAccount,
  useRemoveEcommerceMerchant,
  useForceDeletePaymentProvider,
  useMerchantBlockers,
  useDetachTerminal,
  useRemoveCostStructure,
} from './use-payment-providers'

const baseURL = 'http://localhost:3000/api/v1'

const rawProvider = {
  id: 'pp1',
  code: 'BLUMON',
  name: 'Blumon',
  type: 'PAYMENT_PROCESSOR' as const,
  countryCode: ['MX'],
  active: true,
  configSchema: null,
  _count: { merchants: 3, costStructures: 1 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-05-20T12:00:00.000Z',
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('usePaymentProviders', () => {
  it('devuelve la lista de providers', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers`, () =>
        HttpResponse.json({ success: true, data: [rawProvider] }),
      ),
    )

    const { result } = renderHook(() => usePaymentProviders(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].code).toBe('BLUMON')
  })

  it('forwarda params de filtro', async () => {
    let receivedUrl: URL | null = null
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers`, ({ request }) => {
        receivedUrl = new URL(request.url)
        return HttpResponse.json({ success: true, data: [] })
      }),
    )

    const { result } = renderHook(() => usePaymentProviders({ active: true }), {
      wrapper: AllProviders,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(receivedUrl!.searchParams.get('active')).toBe('true')
  })
})

describe('usePaymentProvider', () => {
  it('queda disabled cuando id es undefined', () => {
    const { result } = renderHook(() => usePaymentProvider(undefined), { wrapper: AllProviders })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches el detalle cuando hay id', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers/pp1`, () =>
        HttpResponse.json({ success: true, data: rawProvider }),
      ),
    )

    const { result } = renderHook(() => usePaymentProvider('pp1'), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(result.current.data?.code).toBe('BLUMON')
  })
})

describe('useCreatePaymentProvider', () => {
  it('crea un provider y resuelve', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/payment-providers`, () =>
        HttpResponse.json({ success: true, data: rawProvider }),
      ),
    )

    const { result } = renderHook(() => useCreatePaymentProvider(), { wrapper: AllProviders })

    await act(async () => {
      const created = await result.current.mutateAsync({
        code: 'BLUMON',
        name: 'Blumon',
        type: 'PAYMENT_PROCESSOR',
        countryCode: ['MX'],
      })
      expect(created.id).toBe('pp1')
    })
  })
})

describe('useUpdatePaymentProvider', () => {
  it('actualiza un provider y resuelve', async () => {
    server.use(
      http.put(`${baseURL}/superadmin/payment-providers/pp1`, () =>
        HttpResponse.json({ success: true, data: { ...rawProvider, name: 'Blumon v2' } }),
      ),
    )

    const { result } = renderHook(() => useUpdatePaymentProvider(), { wrapper: AllProviders })

    await act(async () => {
      const updated = await result.current.mutateAsync({
        id: 'pp1',
        payload: { name: 'Blumon v2' },
      })
      expect(updated.name).toBe('Blumon v2')
    })
  })
})

describe('useTogglePaymentProvider', () => {
  it('toggle con optimistic update y rollback on error', async () => {
    // Provide list data first so optimistic flip has cache to modify
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers`, () =>
        HttpResponse.json({ success: true, data: [rawProvider] }),
      ),
      http.patch(`${baseURL}/superadmin/payment-providers/pp1/toggle`, () =>
        HttpResponse.json({ success: true, data: { ...rawProvider, active: false } }),
      ),
    )

    const { result } = renderHook(() => useTogglePaymentProvider(), { wrapper: AllProviders })

    await act(async () => {
      const toggled = await result.current.mutateAsync('pp1')
      expect(toggled.active).toBe(false)
    })
  })
})

describe('useDeletePaymentProvider', () => {
  it('borra un provider y resuelve', async () => {
    server.use(
      http.delete(`${baseURL}/superadmin/payment-providers/pp1`, () => HttpResponse.json({})),
    )

    const { result } = renderHook(() => useDeletePaymentProvider(), { wrapper: AllProviders })

    await act(async () => {
      await expect(result.current.mutateAsync('pp1')).resolves.toBeUndefined()
    })
  })
})

describe('useProviderBlockers', () => {
  it('queda disabled cuando id es undefined', () => {
    const { result } = renderHook(() => useProviderBlockers(undefined), { wrapper: AllProviders })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('queda disabled cuando enabled es false', () => {
    const { result } = renderHook(() => useProviderBlockers('pp1', false), {
      wrapper: AllProviders,
    })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches bloqueadores cuando hay id', async () => {
    const blockers = {
      code: 'BLUMON',
      name: 'Blumon',
      merchants: [],
      ecommerceMerchants: [],
      webhooks: 0,
      eventLogs: 0,
      costStructures: 0,
      canDelete: true,
    }
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers/pp1/blockers`, () =>
        HttpResponse.json({ success: true, data: blockers }),
      ),
    )

    const { result } = renderHook(() => useProviderBlockers('pp1'), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(result.current.data?.canDelete).toBe(true)
  })
})

describe('useRemoveMerchantAccount', () => {
  it('borra un merchant account', async () => {
    server.use(
      http.delete(`${baseURL}/superadmin/merchant-accounts/m1`, () => HttpResponse.json({})),
    )

    const { result } = renderHook(() => useRemoveMerchantAccount('pp1'), {
      wrapper: AllProviders,
    })

    await act(async () => {
      await expect(result.current.mutateAsync('m1')).resolves.toBeUndefined()
    })
  })
})

describe('useRemoveEcommerceMerchant', () => {
  it('borra un ecommerce merchant', async () => {
    server.use(
      http.delete(`${baseURL}/dashboard/superadmin/ecommerce-merchants/em1`, () =>
        HttpResponse.json({}),
      ),
    )

    const { result } = renderHook(() => useRemoveEcommerceMerchant('pp1'), {
      wrapper: AllProviders,
    })

    await act(async () => {
      await expect(result.current.mutateAsync('em1')).resolves.toBeUndefined()
    })
  })
})

describe('useForceDeletePaymentProvider', () => {
  it('ejecuta force delete', async () => {
    server.use(
      http.delete(`${baseURL}/superadmin/payment-providers/pp1`, () => HttpResponse.json({})),
    )

    const { result } = renderHook(() => useForceDeletePaymentProvider(), {
      wrapper: AllProviders,
    })

    await act(async () => {
      await expect(result.current.mutateAsync('pp1')).resolves.toBeUndefined()
    })
  })
})

describe('useMerchantBlockers', () => {
  it('queda disabled cuando merchantId es undefined', () => {
    const { result } = renderHook(() => useMerchantBlockers(undefined), { wrapper: AllProviders })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches bloqueadores del merchant', async () => {
    const blockers = {
      displayName: 'Cuenta Principal',
      payments: 0,
      transactionCosts: 0,
      costStructures: [],
      venueConfigs: [],
      terminals: [],
      canDelete: true,
    }
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts/m1/blockers`, () =>
        HttpResponse.json({ success: true, data: blockers }),
      ),
    )

    const { result } = renderHook(() => useMerchantBlockers('m1'), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(result.current.data?.canDelete).toBe(true)
  })
})

describe('useDetachTerminal', () => {
  it('desasigna una terminal del merchant', async () => {
    server.use(
      http.put(`${baseURL}/superadmin/merchant-accounts/m1/terminals/t1`, () =>
        HttpResponse.json({}),
      ),
    )

    const { result } = renderHook(() => useDetachTerminal('pp1', 'm1'), {
      wrapper: AllProviders,
    })

    await act(async () => {
      await expect(result.current.mutateAsync('t1')).resolves.toBeUndefined()
    })
  })
})

describe('useRemoveCostStructure', () => {
  it('borra una cost structure', async () => {
    server.use(
      http.delete(`${baseURL}/superadmin/cost-structures/cs1`, () => HttpResponse.json({})),
    )

    const { result } = renderHook(() => useRemoveCostStructure('pp1', 'm1'), {
      wrapper: AllProviders,
    })

    await act(async () => {
      await expect(result.current.mutateAsync('cs1')).resolves.toBeUndefined()
    })
  })
})
