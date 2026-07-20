import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('lista terminales con badge heredada/asignada y pide confirmación al quitar una heredada', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts/m1`, () =>
        HttpResponse.json({
          data: {
            ...rawMerchant,
            terminals: [{ id: 't1', serialNumber: 'AVQD-1', inherited: true }],
            _count: { ...rawMerchant._count, terminals: 1 },
          },
        }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/merchants/:id" element={<MerchantDetailPage />} />
      </Routes>,
      { initialEntries: ['/merchants/m1'] },
    )

    await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())
    expect(screen.getByText('AVQD-1')).toBeInTheDocument()
    expect(screen.getByText('heredada')).toBeInTheDocument()

    // Quitar una heredada NO pega al API directo — abre confirmación primero
    await user.click(screen.getByRole('button', { name: 'Quitar terminal' }))
    expect(await screen.findByText('Quitar terminal heredada')).toBeInTheDocument()
  })

  it('el Asistente prellena el reparto que calculó (100%), no el guardado (50%)', async () => {
    server.use(
      // El merchant YA tiene un reparto 50% guardado — el bug era que el drawer se quedaba con ESE.
      http.get(`${baseURL}/superadmin/merchant-revenue-shares/by-merchant`, () =>
        HttpResponse.json({
          data: {
            id: 'rs1',
            aggregatorPrice: null,
            aggregatorPriceIncludesTax: false,
            avoqadoShareOfProviderMargin: '0.5',
            avoqadoShareOfAggregatorMargin: null,
            taxRate: '0.16',
            active: true,
          },
        }),
      ),
      // Un venue asignado para que el Asistente tenga destino.
      http.get(`${baseURL}/superadmin/venue-pricing/configs-by-merchant/m1`, () =>
        HttpResponse.json({
          data: [{ venue: { id: 'v1', name: 'Berthe', slug: 'berthe' }, secondaryAccountId: 'm1' }],
        }),
      ),
      http.get(`${baseURL}/superadmin/venue-pricing/structures/active/v1/SECONDARY`, () =>
        HttpResponse.json({ data: null }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/merchants/:id" element={<MerchantDetailPage />} />
      </Routes>,
      { initialEntries: ['/merchants/m1'] },
    )
    await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Asistente' }))
    await user.click(screen.getByRole('button', { name: /Siguiente/i })) // paso 1 → 2
    await user.click(screen.getByRole('button', { name: /Costo \+ comisión/i }))
    await user.type(screen.getByLabelText(/Tu comisión/i), '3.5') // cost-plus, SIN socio → 100%
    await user.click(screen.getByRole('button', { name: /Siguiente/i })) // paso 2 → 3
    await user.click(screen.getByRole('button', { name: /Prellenar y revisar/i }))

    const shareInput = (await screen.findByLabelText(
      /Avoqado del margen proveedor/i,
    )) as HTMLInputElement
    expect(shareInput.value).toBe('100')
  })
})
