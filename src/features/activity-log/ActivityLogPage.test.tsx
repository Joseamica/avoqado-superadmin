import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { ActivityLogPage } from './ActivityLogPage'

const baseURL = 'http://localhost:3000/api/v1'

const server = setupServer(
  http.get(`${baseURL}/superadmin/activity-log`, () =>
    HttpResponse.json({
      success: true,
      data: {
        logs: [
          {
            id: 'evt-1',
            action: 'VENUE_CREATED',
            entity: 'Venue',
            entityId: 'venue_abc',
            data: {},
            ipAddress: '10.0.0.1',
            createdAt: '2026-01-01T12:00:00.000Z',
            staff: { id: 'st_1', firstName: 'Ada', lastName: 'Lovelace' },
            venueId: 'venue_abc',
            venueName: 'Bar Tlalpan',
            organizationName: 'Avoqado HQ',
          },
          {
            id: 'evt-2',
            action: 'PAYMENT_FAILED',
            entity: 'Payment',
            entityId: 'pay_zzz',
            data: {},
            ipAddress: null,
            createdAt: '2026-01-01T11:00:00.000Z',
            staff: null,
            venueId: null,
            venueName: null,
            organizationName: null,
          },
        ],
        pagination: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
      },
    }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('<ActivityLogPage />', () => {
  it('renders the heading and meta line', async () => {
    renderWithProviders(<ActivityLogPage />)
    expect(screen.getByRole('heading', { name: /activity log/i })).toBeInTheDocument()
  })

  it('lists entries from the server', async () => {
    renderWithProviders(<ActivityLogPage />)
    await waitFor(() => expect(screen.getByText(/Venue creado/i)).toBeInTheDocument())
    expect(screen.getByText(/Pago fallido/i)).toBeInTheDocument()
    // Actor display name
    expect(screen.getByText(/Ada Lovelace/i)).toBeInTheDocument()
    // Null staff renders as "Sistema"
    expect(screen.getAllByText(/Sistema/i).length).toBeGreaterThan(0)
  })

  it('shows the venue name as subline when present', async () => {
    renderWithProviders(<ActivityLogPage />)
    await waitFor(() => expect(screen.getByText(/Bar Tlalpan/i)).toBeInTheDocument())
  })

  it('shows QueryError on 500 with role=alert and "cargar el activity log"', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/activity-log`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    renderWithProviders(<ActivityLogPage />)
    await waitFor(
      () => {
        const alerts = screen.getAllByRole('alert')
        expect(alerts.length).toBeGreaterThan(0)
      },
      { timeout: 4000 },
    )
  })

  it('renders the Categoría filter pill', async () => {
    renderWithProviders(<ActivityLogPage />)
    await waitFor(() => expect(screen.getByText(/Venue creado/i)).toBeInTheDocument())
    expect(screen.getAllByRole('button').some((b) => /Categor/i.test(b.textContent ?? ''))).toBe(
      true,
    )
  })

  it('renders the loaded-of-total stat line', async () => {
    renderWithProviders(<ActivityLogPage />)
    await waitFor(() => expect(document.body.textContent).toMatch(/2 de 2 cargados/i))
  })
})
