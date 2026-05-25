import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '@/test/render'
import { MerchantDetailPage } from './MerchantDetailPage'

const baseURL = 'http://localhost:3000/api/v1'

// Raw shape as the backend returns it — api.ts maps _count → counts
const rawMerchant = {
  id: 'm1',
  provider: { id: 'p1', code: 'BLUMON', name: 'Blumon', type: 'PAYMENT_PROCESSOR' },
  externalMerchantId: '9814275',
  alias: null,
  displayName: 'Cuenta Principal',
  active: true,
  displayOrder: 0,
  clabeNumber: '0001',
  bankName: 'BBVA',
  accountHolder: 'José A.',
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
  _count: { costStructures: 1, venueConfigs: 0, terminals: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}

const server = setupServer(
  http.get(`${baseURL}/superadmin/merchant-accounts/m1`, () =>
    HttpResponse.json({ data: rawMerchant }),
  ),
  http.get(`${baseURL}/superadmin/cost-structures/active/m1`, () =>
    HttpResponse.json({
      data: {
        id: 'c1',
        debitRate: '0.015',
        creditRate: '0.025',
        amexRate: '0.035',
        internationalRate: '0.04',
        includesTax: true,
        taxRate: '0.16',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        active: true,
      },
    }),
  ),
  http.get(`${baseURL}/superadmin/merchant-revenue-shares/by-merchant`, () =>
    HttpResponse.json({ data: null }),
  ),
  http.get(`${baseURL}/superadmin/settlement-configurations`, () =>
    HttpResponse.json({ data: [] }),
  ),
  http.get(`${baseURL}/superadmin/venue-pricing/configs-by-merchant/m1`, () =>
    HttpResponse.json({ data: [] }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('MerchantDetailPage', () => {
  it('muestra cabecera, readiness y economía', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/merchants/:id" element={<MerchantDetailPage />} />
      </Routes>,
      { initialEntries: ['/merchants/m1'] },
    )

    await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())

    // Identity card — "Credenciales" appears in ReadinessStrip chip AND in the dl field
    expect(screen.getAllByText('Credenciales').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('BBVA')).toBeInTheDocument()

    // MoneyFlow renders with cost data
    expect(screen.getByText('Flujo de dinero')).toBeInTheDocument()
  })
})
