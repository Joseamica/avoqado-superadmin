import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  approveVenueAfterCreate,
  createVenueWizard,
  fetchFeatures,
  fetchMerchantAccountOptions,
  fetchOrganizations,
  fetchVenueDetail,
  fetchVenuePaymentConfig,
  fetchVenueTerminalBrands,
  fetchVenues,
  saveVenuePaymentConfig,
  type CreateVenuePayload,
} from './api'

const baseURL = 'http://localhost:3000/api/v1'

const rawVenueResponse = {
  id: 'v1',
  name: 'Restaurante Pez Volador',
  slug: 'pez-volador',
  status: 'ACTIVE' as const,
  monthlyRevenue: 12000,
  totalTransactions: 0,
  organizationId: 'org1',
  organization: {
    id: 'org1',
    name: 'Grupo Pez Volador',
    email: 'org@pez.mx',
    phone: '+52 55 1111 2222',
  },
  owner: {
    id: 'staff1',
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan@pez.mx',
  },
  analytics: {
    monthlyTransactions: 24,
    monthlyRevenue: 12000,
    averageOrderValue: 500,
    activeUsers: 4,
    lastActivityAt: '2026-05-20T00:00:00.000Z',
  },
  kycStatus: 'VERIFIED',
  statusChangedAt: '2026-05-01T00:00:00.000Z',
  suspensionReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  completeness: {
    hasOwner: true,
    hasTerminal: true,
    hasMerchantAccount: true,
    hasKycDocs: true,
    hasPricing: true,
    kycVerified: true,
  },
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchVenues', () => {
  it('mapea el envelope { success, data } a Venue[]', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues`, () =>
        HttpResponse.json({ success: true, data: [rawVenueResponse] }),
      ),
    )
    const venues = await fetchVenues()
    expect(venues).toHaveLength(1)
    expect(venues[0].id).toBe('v1')
    expect(venues[0].name).toBe('Restaurante Pez Volador')
    expect(venues[0].kycStatus).toBe('VERIFIED')
    expect(venues[0].monthlyTransactions).toBe(24)
    expect(venues[0].averageOrderValue).toBe(500)
  })

  it('normaliza un kycStatus desconocido a null', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues`, () =>
        HttpResponse.json({
          success: true,
          data: [{ ...rawVenueResponse, kycStatus: 'WHATEVER_NEW_STATUS' }],
        }),
      ),
    )
    const venues = await fetchVenues()
    expect(venues[0].kycStatus).toBeNull()
  })

  it('devuelve [] si el envelope no trae array', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues`, () =>
        HttpResponse.json({ success: true, data: null }),
      ),
    )
    const venues = await fetchVenues()
    expect(venues).toEqual([])
  })

  it('manda includeDemos=true cuando params.includeDemos = true', async () => {
    let receivedParam: string | null = null
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues`, ({ request }) => {
        const url = new URL(request.url)
        receivedParam = url.searchParams.get('includeDemos')
        return HttpResponse.json({ success: true, data: [] })
      }),
    )
    await fetchVenues({ includeDemos: true })
    expect(receivedParam).toBe('true')
  })
})

describe('fetchOrganizations', () => {
  it('mapea _count.venues → venueCount', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/onboarding/organizations`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'o1',
              name: 'Grupo Pez',
              slug: 'pez',
              email: 'pez@org.mx',
              _count: { venues: 3 },
              hasPaymentConfig: true,
            },
          ],
        }),
      ),
    )
    const orgs = await fetchOrganizations()
    expect(orgs).toHaveLength(1)
    expect(orgs[0].venueCount).toBe(3)
    expect(orgs[0].hasPaymentConfig).toBe(true)
  })

  it('retorna [] cuando data viene vacío', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/onboarding/organizations`, () =>
        HttpResponse.json({ data: null }),
      ),
    )
    const orgs = await fetchOrganizations()
    expect(orgs).toEqual([])
  })
})

describe('fetchFeatures', () => {
  it('desenvuelve el envelope de features', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/features`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'f1',
              code: 'PAYMENTS',
              name: 'Pagos',
              description: 'Procesamiento de pagos',
              category: 'PAYMENTS',
              isCore: true,
            },
          ],
        }),
      ),
    )
    const features = await fetchFeatures()
    expect(features).toHaveLength(1)
    expect(features[0].code).toBe('PAYMENTS')
    expect(features[0].isCore).toBe(true)
  })

  it('retorna [] si el envelope no trae array', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/features`, () =>
        HttpResponse.json({ success: false, data: null }),
      ),
    )
    const features = await fetchFeatures()
    expect(features).toEqual([])
  })
})

describe('createVenueWizard', () => {
  it('postea al endpoint nuevo y devuelve { venueId, organizationId, steps }', async () => {
    let receivedBody: unknown = null
    server.use(
      http.post(`${baseURL}/superadmin/onboarding/venue`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({
          data: {
            venueId: 'new-v',
            organizationId: 'org1',
            steps: [{ step: 'create', status: 'success' }],
          },
        })
      }),
    )

    const payload: CreateVenuePayload = {
      organization: { mode: 'existing', id: 'org1' },
      venue: { name: 'Nuevo Venue', venueType: 'RESTAURANT' },
    }
    const result = await createVenueWizard(payload)
    expect(result.venueId).toBe('new-v')
    expect(result.organizationId).toBe('org1')
    expect(result.steps).toHaveLength(1)
    expect(receivedBody).toEqual(payload)
  })
})

describe('approveVenueAfterCreate', () => {
  it('hace POST al endpoint de approve', async () => {
    let called = false
    server.use(
      http.post(`${baseURL}/dashboard/superadmin/venues/v1/approve`, () => {
        called = true
        return HttpResponse.json({ success: true, data: {} })
      }),
    )
    await approveVenueAfterCreate('v1')
    expect(called).toBe(true)
  })
})

describe('fetchVenueDetail', () => {
  it('devuelve Venue mapeado en éxito', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues/v1`, () =>
        HttpResponse.json({ success: true, data: rawVenueResponse }),
      ),
    )
    const venue = await fetchVenueDetail('v1')
    expect(venue).not.toBeNull()
    expect(venue!.id).toBe('v1')
    expect(venue!.name).toBe('Restaurante Pez Volador')
  })

  it('devuelve null si el backend responde 404', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues/missing`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
    )
    const venue = await fetchVenueDetail('missing')
    expect(venue).toBeNull()
  })

  it('relanza errores que no son 404', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues/boom`, () =>
        HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }),
      ),
    )
    await expect(fetchVenueDetail('boom')).rejects.toThrow()
  })

  it('devuelve null si data está ausente', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues/empty`, () =>
        HttpResponse.json({ success: true, data: null }),
      ),
    )
    const venue = await fetchVenueDetail('empty')
    expect(venue).toBeNull()
  })
})

describe('fetchVenuePaymentConfig', () => {
  it('devuelve null si el backend retorna 404', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/venue-pricing/config/v1`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
    )
    const config = await fetchVenuePaymentConfig('v1')
    expect(config).toBeNull()
  })

  it('mapea la respuesta a VenuePaymentConfig con defaults', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/venue-pricing/config/v1`, () =>
        HttpResponse.json({
          data: {
            primaryAccountId: 'ma1',
            secondaryAccountId: null,
            tertiaryAccountId: null,
          },
        }),
      ),
    )
    const config = await fetchVenuePaymentConfig('v1')
    expect(config).not.toBeNull()
    expect(config!.primaryAccountId).toBe('ma1')
    // Default cuando no llega preferredProcessor
    expect(config!.preferredProcessor).toBe('AUTO')
  })

  it('devuelve null si data viene null', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/venue-pricing/config/v1`, () =>
        HttpResponse.json({ data: null }),
      ),
    )
    const config = await fetchVenuePaymentConfig('v1')
    expect(config).toBeNull()
  })
})

describe('saveVenuePaymentConfig', () => {
  it('usa PUT cuando exists = true', async () => {
    let method: string | null = null
    server.use(
      http.put(`${baseURL}/superadmin/venue-pricing/config/v1`, ({ request }) => {
        method = request.method
        return HttpResponse.json({ data: {} })
      }),
    )
    await saveVenuePaymentConfig('v1', true, {
      primaryAccountId: 'ma1',
      secondaryAccountId: null,
      tertiaryAccountId: null,
      preferredProcessor: 'AUTO',
    })
    expect(method).toBe('PUT')
  })

  it('usa POST cuando exists = false', async () => {
    let method: string | null = null
    let body: unknown = null
    server.use(
      http.post(`${baseURL}/superadmin/venue-pricing/config`, async ({ request }) => {
        method = request.method
        body = await request.json()
        return HttpResponse.json({ data: {} })
      }),
    )
    await saveVenuePaymentConfig('v1', false, {
      primaryAccountId: 'ma1',
      secondaryAccountId: null,
      tertiaryAccountId: null,
      preferredProcessor: 'AUTO',
    })
    expect(method).toBe('POST')
    expect(body).toMatchObject({ venueId: 'v1', primaryAccountId: 'ma1' })
  })
})

describe('fetchMerchantAccountOptions', () => {
  it('mapea merchant accounts a options con label fallback', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'ma1',
              displayName: 'Cuenta Principal',
              alias: null,
              externalMerchantId: '9814275',
              blumonEnvironment: 'SANDBOX',
              provider: { code: 'BLUMON', name: 'Blumon' },
            },
            {
              id: 'ma2',
              displayName: null,
              alias: null,
              externalMerchantId: '111',
              blumonEnvironment: null,
              provider: { code: 'ANGELPAY', name: 'AngelPay' },
            },
          ],
        }),
      ),
    )
    const options = await fetchMerchantAccountOptions()
    expect(options).toHaveLength(2)
    expect(options[0].label).toBe('Cuenta Principal')
    expect(options[1].label).toBe('111') // fallback al externalMerchantId
    expect(options[0].providerCode).toBe('BLUMON')
  })

  it('retorna [] si data no es array', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts`, () => HttpResponse.json({ data: null })),
    )
    const options = await fetchMerchantAccountOptions()
    expect(options).toEqual([])
  })
})

describe('fetchVenueTerminalBrands', () => {
  it('devuelve las brands de las terminales ACTIVAS en mayúsculas', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/terminals`, () =>
        HttpResponse.json({
          data: [
            { brand: 'pax', status: 'ACTIVE' },
            { brand: 'nexgo', status: 'ACTIVE' },
            { brand: 'pax', status: 'INACTIVE' }, // excluida
            { brand: null, status: 'ACTIVE' }, // excluida por brand null
          ],
        }),
      ),
    )
    const brands = await fetchVenueTerminalBrands('v1')
    expect(brands).toEqual(['PAX', 'NEXGO'])
  })

  it('devuelve [] cuando el endpoint falla (best-effort)', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/terminals`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    const brands = await fetchVenueTerminalBrands('v1')
    expect(brands).toEqual([])
  })
})
