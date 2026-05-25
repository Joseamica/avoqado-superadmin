import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { renderHook, waitFor } from '@testing-library/react'
import { AllProviders } from '@/test/render'
import {
  useCreateVenue,
  useFeatures,
  useMerchantAccountOptions,
  useOrganizations,
  useSaveVenuePaymentConfig,
  useVenueDetail,
  useVenuePaymentConfig,
  useVenueTerminalBrands,
  useVenues,
} from './use-venues'

const baseURL = 'http://localhost:3000/api/v1'

const rawVenue = {
  id: 'v1',
  name: 'Pez Volador',
  slug: 'pez-volador',
  status: 'ACTIVE' as const,
  monthlyRevenue: 1000,
  totalTransactions: 0,
  organizationId: 'org1',
  organization: { id: 'org1', name: 'Grupo Pez', email: 'org@pez.mx' },
  owner: { id: 's1', firstName: 'Juan', lastName: 'Pérez', email: 'juan@pez.mx' },
  analytics: {
    monthlyTransactions: 2,
    monthlyRevenue: 1000,
    averageOrderValue: 500,
    activeUsers: 1,
    lastActivityAt: '2026-05-01T00:00:00.000Z',
  },
  kycStatus: 'VERIFIED',
  statusChangedAt: null,
  suspensionReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('useVenues', () => {
  it('devuelve venues mapeados al resolverse', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues`, () =>
        HttpResponse.json({ success: true, data: [rawVenue] }),
      ),
    )
    const { result } = renderHook(() => useVenues(), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].id).toBe('v1')
  })

  it('reporta error cuando el endpoint falla', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    const { result } = renderHook(() => useVenues(), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useOrganizations', () => {
  it('mapea organizations al resolverse', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/onboarding/organizations`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'o1',
              name: 'Org 1',
              slug: 'o1',
              email: 'o1@mx',
              _count: { venues: 2 },
              hasPaymentConfig: false,
            },
          ],
        }),
      ),
    )
    const { result } = renderHook(() => useOrganizations(), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].venueCount).toBe(2)
  })
})

describe('useFeatures', () => {
  it('devuelve los features del backend', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/features`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'f1',
              code: 'PAYMENTS',
              name: 'Pagos',
              description: 'Procesar pagos',
              category: 'PAYMENTS',
              isCore: true,
            },
          ],
        }),
      ),
    )
    const { result } = renderHook(() => useFeatures(), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].code).toBe('PAYMENTS')
  })
})

describe('useVenueDetail', () => {
  it('devuelve null sin venueId — query disabled', () => {
    const { result } = renderHook(() => useVenueDetail(undefined), { wrapper: AllProviders })
    // disabled queries no corren ni triunfan
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('devuelve el venue cuando llega del backend', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues/v1`, () =>
        HttpResponse.json({ success: true, data: rawVenue }),
      ),
    )
    const { result } = renderHook(() => useVenueDetail('v1'), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.id).toBe('v1')
  })

  it('devuelve null cuando el backend retorna 404', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues/missing`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
    )
    const { result } = renderHook(() => useVenueDetail('missing'), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })
})

describe('useCreateVenue', () => {
  it('hace POST a /superadmin/onboarding/venue', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/onboarding/venue`, () =>
        HttpResponse.json({
          data: { venueId: 'new-v', organizationId: 'org1', steps: [] },
        }),
      ),
    )
    const { result } = renderHook(() => useCreateVenue(), { wrapper: AllProviders })
    const out = await result.current.mutateAsync({
      payload: {
        organization: { mode: 'existing', id: 'org1' },
        venue: { name: 'Test', venueType: 'RESTAURANT' },
      },
      approveKyc: false,
    })
    expect(out.venueId).toBe('new-v')
  })

  it('hace el approve adicional cuando approveKyc=true', async () => {
    let approveCalled = false
    server.use(
      http.post(`${baseURL}/superadmin/onboarding/venue`, () =>
        HttpResponse.json({
          data: { venueId: 'new-v', organizationId: 'org1', steps: [] },
        }),
      ),
      http.post(`${baseURL}/dashboard/superadmin/venues/new-v/approve`, () => {
        approveCalled = true
        return HttpResponse.json({ success: true, data: {} })
      }),
    )
    const { result } = renderHook(() => useCreateVenue(), { wrapper: AllProviders })
    await result.current.mutateAsync({
      payload: {
        organization: { mode: 'existing', id: 'org1' },
        venue: { name: 'Test', venueType: 'RESTAURANT' },
      },
      approveKyc: true,
    })
    expect(approveCalled).toBe(true)
  })
})

describe('useVenuePaymentConfig', () => {
  it('disabled cuando no hay venueId', () => {
    const { result } = renderHook(() => useVenuePaymentConfig(undefined), { wrapper: AllProviders })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('devuelve el config cuando llega del backend', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/venue-pricing/config/v1`, () =>
        HttpResponse.json({
          data: {
            primaryAccountId: 'ma1',
            secondaryAccountId: null,
            tertiaryAccountId: null,
            preferredProcessor: 'LEGACY',
          },
        }),
      ),
    )
    const { result } = renderHook(() => useVenuePaymentConfig('v1'), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.primaryAccountId).toBe('ma1')
    expect(result.current.data!.preferredProcessor).toBe('LEGACY')
  })
})

describe('useMerchantAccountOptions', () => {
  it('devuelve options mapeadas', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'ma1',
              displayName: 'Cuenta',
              alias: null,
              externalMerchantId: '111',
              blumonEnvironment: 'SANDBOX',
              provider: { code: 'BLUMON', name: 'Blumon' },
            },
          ],
        }),
      ),
    )
    const { result } = renderHook(() => useMerchantAccountOptions(), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].providerCode).toBe('BLUMON')
  })
})

describe('useVenueTerminalBrands', () => {
  it('disabled sin venueId', () => {
    const { result } = renderHook(() => useVenueTerminalBrands(undefined), {
      wrapper: AllProviders,
    })
    expect(result.current.isLoading).toBe(false)
  })

  it('devuelve brands desde el endpoint', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/terminals`, () =>
        HttpResponse.json({
          data: [{ brand: 'PAX', status: 'ACTIVE' }],
        }),
      ),
    )
    const { result } = renderHook(() => useVenueTerminalBrands('v1'), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(['PAX'])
  })
})

describe('useSaveVenuePaymentConfig', () => {
  it('hace PUT al endpoint con exists=true', async () => {
    let putCalled = false
    server.use(
      http.put(`${baseURL}/superadmin/venue-pricing/config/v1`, () => {
        putCalled = true
        return HttpResponse.json({ data: {} })
      }),
    )
    const { result } = renderHook(() => useSaveVenuePaymentConfig('v1'), {
      wrapper: AllProviders,
    })
    await result.current.mutateAsync({
      exists: true,
      input: {
        primaryAccountId: 'ma1',
        secondaryAccountId: null,
        tertiaryAccountId: null,
        preferredProcessor: 'AUTO',
      },
    })
    expect(putCalled).toBe(true)
  })
})
