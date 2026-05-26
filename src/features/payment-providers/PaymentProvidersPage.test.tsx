import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { PaymentProvidersPage } from './PaymentProvidersPage'

const baseURL = 'http://localhost:3000/api/v1'

const sampleProviders = [
  {
    id: 'pp1',
    code: 'BLUMON',
    name: 'Blumon PAX',
    type: 'PAYMENT_PROCESSOR',
    countryCode: ['MX'],
    active: true,
    configSchema: null,
    _count: { merchants: 5, costStructures: 2 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-05-20T12:00:00.000Z',
  },
  {
    id: 'pp2',
    code: 'STRIPE',
    name: 'Stripe',
    type: 'GATEWAY',
    countryCode: ['MX', 'US'],
    active: false,
    configSchema: null,
    _count: { merchants: 0, costStructures: 0 },
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-05-21T12:00:00.000Z',
  },
]

const server = setupServer(
  http.get(`${baseURL}/dashboard/auth/status`, () =>
    HttpResponse.json({
      authenticated: true,
      user: {
        id: 'u1',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@avoqado.io',
        photoUrl: null,
        venues: [
          {
            id: 'v1',
            name: 'HQ',
            slug: 'hq',
            logo: null,
            role: 'SUPERADMIN',
            timezone: 'America/Mexico_City',
          },
        ],
      },
    }),
  ),
  http.get(`${baseURL}/superadmin/payment-providers`, () =>
    HttpResponse.json({ success: true, data: sampleProviders }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('PaymentProvidersPage', () => {
  it('renderiza la tabla con providers', async () => {
    renderWithProviders(<PaymentProvidersPage />)

    await waitFor(
      () => {
        expect(screen.getByText('Blumon PAX')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )

    expect(screen.getByText('Stripe')).toBeInTheDocument()
  })

  it('muestra link para crear nuevo provider', async () => {
    renderWithProviders(<PaymentProvidersPage />)

    await waitFor(
      () => {
        expect(screen.getByText('Blumon PAX')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )

    expect(screen.getByRole('link', { name: /nuevo/i })).toHaveAttribute(
      'href',
      '/payment-providers/new',
    )
  })

  it('renderiza estado de error cuando falla el fetch', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers`, () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 }),
      ),
    )

    renderWithProviders(<PaymentProvidersPage />)

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
  })
})
