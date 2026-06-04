import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { SubscriptionsPage } from './SubscriptionsPage'

const baseURL = 'http://localhost:3000/api/v1'
const server = setupServer(
  http.get(`${baseURL}/superadmin/subscriptions/overview`, () =>
    HttpResponse.json({
      success: true,
      data: {
        counts: {
          active: 2,
          trial: 1,
          canceling: 0,
          past_due: 0,
          suspended: 1,
          canceled: 0,
          none: 0,
          total: 4,
        },
        mrr: { total: 2317.68, currency: 'MXN' },
        trialsEndingSoon: [],
      },
    }),
  ),
  http.get(`${baseURL}/superadmin/subscriptions/venues`, () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          venueId: 'v1',
          name: 'Lagree HQ',
          slug: 'lagree-hq',
          planTier: 'PRO',
          state: 'active',
          trialEndsAt: null,
          currentPeriodEnd: '2026-07-01T00:00:00.000Z',
          mrr: 1158.84,
          stripeSubscriptionId: 'sub_1',
          owner: { name: 'Ana', email: 'ana@x.mx' },
        },
        {
          venueId: 'v2',
          name: 'Iyashi Spa',
          slug: 'iyashi',
          planTier: 'PRO',
          state: 'suspended',
          trialEndsAt: null,
          currentPeriodEnd: null,
          mrr: 0,
          stripeSubscriptionId: 'sub_2',
          owner: { name: 'Bea', email: 'bea@x.mx' },
        },
      ],
      meta: { total: 2, page: 1, pageSize: 200 },
    }),
  ),
)
beforeEach(() => server.resetHandlers())

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SubscriptionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SubscriptionsPage', () => {
  it('renders the MRR summary and a row per venue', async () => {
    server.listen({ onUnhandledRequest: 'bypass' })
    renderPage()
    expect(await screen.findByText('Lagree HQ')).toBeInTheDocument()
    expect(screen.getByText('Iyashi Spa')).toBeInTheDocument()
    // MRR total appears in the summary header
    expect(screen.getByText(/2,317\.68/)).toBeInTheDocument()
    server.close()
  })
})
