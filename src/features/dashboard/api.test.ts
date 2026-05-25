import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { fetchDashboardSummary } from './api'

const baseURL = 'http://localhost:3000/api/v1'

const sample = {
  venues: { total: 100, active: 90, suspended: 10 },
  terminals: { total: 50, active: 45, inactive: 3, pendingActivation: 2 },
  kyc: { pendingReview: 5, inReview: 2, verified: 80, rejected: 1, notSubmitted: 12 },
  staff: { total: 250 },
  payments24h: { count: 1500, volumeCents: 12_345_678, failedCount: 3 },
  activityLog: { last24h: 240 },
}

const server = setupServer(
  http.get(`${baseURL}/superadmin/dashboard/summary`, () =>
    HttpResponse.json({ success: true, data: sample }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchDashboardSummary', () => {
  it('returns the inner data envelope', async () => {
    const result = await fetchDashboardSummary()
    expect(result).toEqual(sample)
  })

  it('propagates errors when the request fails', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/dashboard/summary`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    await expect(fetchDashboardSummary()).rejects.toBeDefined()
  })
})
