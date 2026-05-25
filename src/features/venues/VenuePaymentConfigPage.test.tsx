import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '@/test/render'
import { VenuePaymentConfigPage } from './VenuePaymentConfigPage'

const baseURL = 'http://localhost:3000/api/v1'

// Minimal venue detail shape (legacy namespace, wrapped in { success, data })
const rawVenue = {
  id: 'v1',
  name: 'Doña Simona',
  slug: 'dona-simona',
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

// Capture PUT body so we can assert its contents
let capturedPutBody: Record<string, unknown> | null = null

const server = setupServer(
  // venue detail — legacy /dashboard/superadmin namespace
  http.get(`${baseURL}/dashboard/superadmin/venues/v1`, () =>
    HttpResponse.json({ success: true, data: rawVenue }),
  ),

  // existing payment config — prefills form with primaryAccountId: 'm1'
  http.get(`${baseURL}/superadmin/venue-pricing/config/v1`, () =>
    HttpResponse.json({
      data: {
        primaryAccountId: 'm1',
        secondaryAccountId: null,
        tertiaryAccountId: null,
        preferredProcessor: 'AUTO',
        routingRules: null,
      },
    }),
  ),

  // merchant account options
  http.get(`${baseURL}/superadmin/merchant-accounts`, () =>
    HttpResponse.json({
      data: [
        {
          id: 'm1',
          displayName: 'Cuenta A',
          alias: null,
          externalMerchantId: '9814',
          blumonEnvironment: 'SANDBOX',
          provider: { code: 'BLUMON', name: 'Blumon' },
        },
      ],
    }),
  ),

  // terminal brands — no active terminals
  http.get(`${baseURL}/superadmin/terminals`, () => HttpResponse.json({ data: [] })),

  // PUT to save config — capture body for assertion
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
      {/* stub destination so navigate() doesn't explode */}
      <Route path="/venues/:venueId" element={<div>venue detail</div>} />
    </Routes>,
    { initialEntries: ['/venues/v1/merchant'] },
  )
}

describe('VenuePaymentConfigPage', () => {
  it('renders the page title and venue name after data loads', async () => {
    renderPage()

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Configurar pagos', level: 1 }),
      ).toBeInTheDocument(),
    )
    await waitFor(() => expect(screen.getByText('Doña Simona')).toBeInTheDocument())
  })

  it('renders the "Cuenta principal *" label', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Cuenta principal *')).toBeInTheDocument())
  })

  it('submitting resends the pre-loaded primaryAccountId in the PUT body', async () => {
    renderPage()

    // Wait for form to be hydrated with config data (primary = 'm1' already set)
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Configurar pagos', level: 1 }),
      ).toBeInTheDocument(),
    )
    // Wait for merchant account options to load so hydration can resolve
    await waitFor(() => expect(screen.queryByText('Cuenta principal *')).toBeInTheDocument())

    // Give TanStack Query time to hydrate form state from configQ.isSuccess
    await waitFor(() => {
      // The combobox trigger for "Cuenta principal" should show the loaded account label
      // or the form must at least be rendered; we click Guardar to trigger submit
      const submitBtn = screen.getByRole('button', { name: /guardar/i })
      expect(submitBtn).toBeInTheDocument()
    })

    const submitBtn = screen.getByRole('button', { name: /guardar/i })
    fireEvent.click(submitBtn)

    // Assert the PUT request was made with the correct primaryAccountId
    await waitFor(() => expect(capturedPutBody).not.toBeNull())
    expect(capturedPutBody!.primaryAccountId).toBe('m1')
  })
})
