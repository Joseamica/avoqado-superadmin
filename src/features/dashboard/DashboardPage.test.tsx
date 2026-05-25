import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { DashboardPage } from './DashboardPage'

const baseURL = 'http://localhost:3000/api/v1'

const baseSummary = {
  venues: { total: 100, active: 90, suspended: 10 },
  terminals: { total: 50, active: 45, inactive: 3, pendingActivation: 2 },
  kyc: { pendingReview: 5, inReview: 2, verified: 80, rejected: 1, notSubmitted: 12 },
  staff: { total: 250 },
  payments24h: { count: 1500, volumeCents: 12_345_678, failedCount: 3 },
  activityLog: { last24h: 240 },
}

const baseRecent = {
  logs: [
    {
      id: 'r1',
      action: 'VENUE_CREATED',
      entity: 'Venue',
      entityId: 'v1',
      data: {},
      ipAddress: null,
      createdAt: '2026-01-01T12:00:00.000Z',
      staff: { id: 's1', firstName: 'Ada', lastName: 'Lovelace' },
      venueId: 'v1',
      venueName: 'Bar Tlalpan',
      organizationName: null,
    },
  ],
  pagination: { page: 1, pageSize: 5, total: 1, totalPages: 1 },
}

const server = setupServer(
  http.get(`${baseURL}/superadmin/dashboard/summary`, () =>
    HttpResponse.json({ success: true, data: baseSummary }),
  ),
  http.get(`${baseURL}/superadmin/activity-log`, () =>
    HttpResponse.json({ success: true, data: baseRecent }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('<DashboardPage />', () => {
  it('renders the heading', () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByRole('heading', { name: /resumen de la plataforma/i })).toBeInTheDocument()
  })

  it('shows KPI labels', async () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByText(/Venues activos/i)).toBeInTheDocument()
    expect(screen.getByText(/TPVs activos/i)).toBeInTheDocument()
    expect(screen.getByText(/KYC pendientes/i)).toBeInTheDocument()
    expect(screen.getByText(/Pagos · 24h/i)).toBeInTheDocument()
  })

  it('renders KPI values after summary loads', async () => {
    renderWithProviders(<DashboardPage />)
    await waitFor(() => expect(screen.getByText(/90 \/ 100/i)).toBeInTheDocument())
    expect(screen.getByText(/45 \/ 50/i)).toBeInTheDocument()
    // KYC pending = 5 + 2 = 7
    expect(screen.getByText(/^7$/)).toBeInTheDocument()
  })

  it('renders the API health pill', () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByText(/API saludable/i)).toBeInTheDocument()
  })

  it('renders recent activity entries', async () => {
    renderWithProviders(<DashboardPage />)
    await waitFor(() => expect(screen.getByText(/Venue creado/i)).toBeInTheDocument())
    expect(screen.getByText(/Ada Lovelace/i)).toBeInTheDocument()
  })

  it('renders an attention card when payments24h.failedCount > 0', async () => {
    renderWithProviders(<DashboardPage />)
    await waitFor(() => expect(screen.getByText(/3 pagos fallidos en 24h/i)).toBeInTheDocument())
  })

  it('shows the "todo en orden" card when nothing needs attention', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/dashboard/summary`, () =>
        HttpResponse.json({
          success: true,
          data: {
            ...baseSummary,
            kyc: { ...baseSummary.kyc, pendingReview: 0, inReview: 0 },
            terminals: { ...baseSummary.terminals, pendingActivation: 0 },
            payments24h: { ...baseSummary.payments24h, failedCount: 0 },
          },
        }),
      ),
    )
    renderWithProviders(<DashboardPage />)
    await waitFor(() => expect(screen.getByText(/Todo en orden/i)).toBeInTheDocument())
  })

  it('renders QueryError when summary fails', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/dashboard/summary`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    renderWithProviders(<DashboardPage />)
    await waitFor(
      () => {
        const alerts = screen.getAllByRole('alert')
        expect(alerts.length).toBeGreaterThan(0)
      },
      { timeout: 4000 },
    )
  })

  it('renders the "Ver todo el log" link', async () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByRole('link', { name: /ver todo el log/i })).toBeInTheDocument()
  })
})
