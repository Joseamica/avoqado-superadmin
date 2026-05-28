import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { EarningsPage } from './EarningsPage'
import { EARNINGS_ALL_TIME_START } from './api'

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

const summaryPayload = {
  success: true,
  data: {
    range: {
      startDate: '2026-05-01T00:00:00.000Z',
      endDate: '2026-05-31T00:00:00.000Z',
    },
    totals: {
      netProfit: 128450.2,
      terminalNet: 119800,
      onlineFees: 8650.2,
      tramoProvider: 90000,
      tramoAggregator: 29800,
      aggregatorKept: 5000,
      volume: 4200000,
      transactions: 18204,
      averageMargin: 0.0285,
    },
    byVenue: [],
    byMerchant: [],
    byProvider: [],
    byCardType: [],
    byChannel: [],
  },
}

describe('EarningsPage', () => {
  it('renders KPIs from the summary endpoint', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/earnings/summary`, () => HttpResponse.json(summaryPayload)),
      http.get(`${baseURL}/superadmin/earnings/time-series`, () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    )
    renderWithProviders(<EarningsPage />)
    expect(await screen.findByText('$128,450.20')).toBeInTheDocument()
  })

  it('requests all history by default (no period filter sends the epoch floor, not current month)', async () => {
    let capturedStart: string | null = null
    server.use(
      http.get(`${baseURL}/superadmin/earnings/summary`, ({ request }) => {
        capturedStart = new URL(request.url).searchParams.get('startDate')
        return HttpResponse.json(summaryPayload)
      }),
      http.get(`${baseURL}/superadmin/earnings/time-series`, () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    )
    renderWithProviders(<EarningsPage />)
    await screen.findByText('$128,450.20')
    expect(capturedStart).toBe(EARNINGS_ALL_TIME_START)
  })
})
