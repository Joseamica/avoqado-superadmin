import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { EarningsPage } from './EarningsPage'

// jsdom lacks ResizeObserver (recharts needs it when the trend chart renders).
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const baseURL = 'http://localhost:3000/api/v1'
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('EarningsPage', () => {
  it('renders KPIs from the summary endpoint', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/earnings/summary`, () =>
        HttpResponse.json({
          success: true,
          data: {
            range: {
              startDate: '2026-05-01T00:00:00.000Z',
              endDate: '2026-05-31T00:00:00.000Z',
            },
            totals: {
              grossProfit: 128450.2,
              terminalProfit: 119800,
              onlineFees: 8650.2,
              volume: 4200000,
              transactions: 18204,
              averageMargin: 0.0306,
            },
            byVenue: [],
            byMerchant: [],
            byProvider: [],
            byCardType: [],
            byChannel: [],
          },
        }),
      ),
      http.get(`${baseURL}/superadmin/earnings/time-series`, () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    )
    renderWithProviders(<EarningsPage />)
    expect(await screen.findByText('$128,450.20')).toBeInTheDocument()
  })
})
