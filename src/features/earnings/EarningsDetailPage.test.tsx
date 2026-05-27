import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { EarningsDetailPage } from './EarningsDetailPage'

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

const summary = {
  range: { startDate: '2026-05-01T00:00:00.000Z', endDate: '2026-05-31T00:00:00.000Z' },
  totals: {
    netProfit: 22193.23,
    terminalNet: 22000,
    onlineFees: 193.23,
    tramoProvider: 15000,
    tramoAggregator: 7000,
    aggregatorKept: 0,
    volume: 1286530.5,
    transactions: 123,
    averageMargin: 0.017,
  },
  byVenue: [
    {
      venueId: 'v1',
      venueName: 'IQ',
      netProfit: 22193.23,
      terminalNet: 22000,
      onlineFees: 193.23,
      volume: 1286530.5,
      transactions: 123,
      hasRevenueShare: false,
    },
  ],
  byMerchant: [
    {
      merchantAccountId: 'm1',
      label: 'Cuenta IQ',
      providerCode: 'MENTA',
      hasAggregator: false,
      hasRevenueShare: false,
      netProfit: 22000,
      tramoProvider: 22000,
      tramoAggregator: 0,
      volume: 1286530.5,
      transactions: 123,
    },
  ],
  byProvider: [],
  byCardType: [],
  byChannel: [],
}

describe('EarningsDetailPage', () => {
  it('shows the scoped venue name + KPIs', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/earnings/summary`, () =>
        HttpResponse.json({ success: true, data: summary }),
      ),
      http.get(`${baseURL}/superadmin/earnings/time-series`, () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    )
    renderWithProviders(
      <Routes>
        <Route path="/earnings/venue/:venueId" element={<EarningsDetailPage />} />
      </Routes>,
      { initialEntries: ['/earnings/venue/v1'] },
    )
    expect(await screen.findByRole('heading', { name: 'IQ' })).toBeInTheDocument()
    expect(screen.getByText('$22,193.23')).toBeInTheDocument()
  })
})
