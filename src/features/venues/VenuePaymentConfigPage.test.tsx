import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '@/test/render'
import { VenuePaymentConfigPage } from './VenuePaymentConfigPage'

const baseURL = 'http://localhost:3000/api/v1'

const rawVenue = {
  id: 'v1',
  name: 'Amaena',
  slug: 'amaena',
  status: 'ACTIVE' as const,
  organizationId: 'o1',
  organization: { id: 'o1', name: 'Org', email: 'o@x.com' },
  owner: { id: 'u1', firstName: 'A', lastName: 'B', email: 'a@b.com' },
  analytics: {
    monthlyTransactions: 0,
    monthlyRevenue: 0,
    averageOrderValue: 0,
    activeUsers: 0,
    lastActivityAt: '2026-01-01T00:00:00.000Z',
  },
  monthlyRevenue: 0,
  totalTransactions: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const rawAccounts = [
  {
    id: 'm1',
    displayName: 'Amaena - A',
    alias: null,
    externalMerchantId: '776',
    blumonEnvironment: null,
    provider: { code: 'ANGELPAY', name: 'AngelPay' },
  },
  {
    id: 'm2',
    displayName: 'Amaena - B',
    alias: null,
    externalMerchantId: '814',
    blumonEnvironment: null,
    provider: { code: 'ANGELPAY', name: 'AngelPay' },
  },
  {
    id: 'm3',
    displayName: 'Amaena - Externo',
    alias: null,
    externalMerchantId: 'blumon_1',
    blumonEnvironment: 'PRODUCTION',
    provider: { code: 'BLUMON', name: 'Blumon' },
  },
]

let capturedPutBody: Record<string, unknown> | null = null

const server = setupServer(
  http.get(`${baseURL}/dashboard/superadmin/venues/v1`, () =>
    HttpResponse.json({ success: true, data: rawVenue }),
  ),
  http.get(`${baseURL}/superadmin/venue-pricing/config/v1`, () =>
    HttpResponse.json({
      data: {
        primaryAccountId: 'm1',
        secondaryAccountId: 'm2',
        tertiaryAccountId: null,
        preferredProcessor: 'AUTO',
        routingRules: null,
      },
    }),
  ),
  http.get(`${baseURL}/superadmin/merchant-accounts`, () =>
    HttpResponse.json({ data: rawAccounts }),
  ),
  http.get(`${baseURL}/superadmin/terminals`, () => HttpResponse.json({ data: [] })),
  http.put(`${baseURL}/superadmin/venue-pricing/config/v1`, async ({ request }) => {
    capturedPutBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ data: {} })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  capturedPutBody = null
})
afterAll(() => server.close())

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/venues/:venueId/merchant" element={<VenuePaymentConfigPage />} />
      <Route path="/venues/:venueId" element={<div>venue detail</div>} />
    </Routes>,
    { initialEntries: ['/venues/v1/merchant'] },
  )
}

describe('VenuePaymentConfigPage (slots)', () => {
  it('muestra el título y los slots en orden con sus etiquetas', async () => {
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Slots de pago', level: 1 })).toBeInTheDocument(),
    )
    await waitFor(() => expect(screen.getByText('Principal')).toBeInTheDocument())
    expect(screen.getByText('Secundaria')).toBeInTheDocument()
    // Sólo 2 cuentas asignadas → sin Terciaria.
    expect(screen.queryByText('Terciaria')).not.toBeInTheDocument()
  })

  it('reordenar (subir la secundaria) intercambia primario/secundario al guardar', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Secundaria')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Subir Secundaria/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(capturedPutBody).not.toBeNull())
    expect(capturedPutBody!.primaryAccountId).toBe('m2')
    expect(capturedPutBody!.secondaryAccountId).toBe('m1')
    expect(capturedPutBody!.tertiaryAccountId).toBeNull()
  })

  it('quitar un slot lo manda como null al guardar', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Secundaria')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Quitar Secundaria/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(capturedPutBody).not.toBeNull())
    expect(capturedPutBody!.primaryAccountId).toBe('m1')
    expect(capturedPutBody!.secondaryAccountId).toBeNull()
  })
})
