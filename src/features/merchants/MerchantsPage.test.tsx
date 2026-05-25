import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { MerchantsPage } from './MerchantsPage'

const baseURL = 'http://localhost:3000/api/v1'

const server = setupServer(
  http.get(`${baseURL}/superadmin/merchant-accounts`, () =>
    HttpResponse.json({
      success: true,
      count: 1,
      data: [
        {
          id: 'm1',
          provider: { id: 'p1', code: 'BLUMON', name: 'Blumon', type: 'PAYMENT_PROCESSOR' },
          externalMerchantId: '9814275',
          alias: null,
          displayName: 'Cuenta Principal',
          active: true,
          displayOrder: 0,
          clabeNumber: null,
          bankName: null,
          accountHolder: null,
          hasCredentials: true,
          blumonSerialNumber: '2841548417',
          blumonPosId: '376',
          blumonEnvironment: 'SANDBOX',
          blumonMerchantId: null,
          angelpayAffiliation: null,
          angelpayMerchantName: null,
          aggregatorId: null,
          venues: [],
          terminals: [],
          // Raw shape: api.ts mapper converts _count → counts
          _count: { costStructures: 1, venueConfigs: 1, terminals: 1 },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('MerchantsPage', () => {
  it('lista los merchant accounts', async () => {
    renderWithProviders(<MerchantsPage />)
    await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())
    expect(screen.getByText('Blumon')).toBeInTheDocument()
    expect(screen.getByText('Sandbox')).toBeInTheDocument()
  })

  it('muestra el estado Activa', async () => {
    renderWithProviders(<MerchantsPage />)
    await waitFor(() => expect(screen.getByText('Activa')).toBeInTheDocument())
  })

  it('muestra el externalMerchantId como subtítulo', async () => {
    renderWithProviders(<MerchantsPage />)
    await waitFor(() => expect(screen.getByText(/9814275/)).toBeInTheDocument())
  })

  it('muestra error si el endpoint falla', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts`, () =>
        HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }),
      ),
    )
    renderWithProviders(<MerchantsPage />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
