import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { fetchSubscriptionOverview, fetchVenueSubscriptions } from './api'

const baseURL = 'http://localhost:3000/api/v1'
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchSubscriptionOverview', () => {
  it('unwraps { success, data }', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/subscriptions/overview`, () =>
        HttpResponse.json({
          success: true,
          data: {
            counts: {
              active: 2,
              trial: 1,
              canceling: 0,
              past_due: 0,
              suspended: 0,
              canceled: 0,
              none: 3,
              total: 6,
            },
            mrr: { total: 2317.68, currency: 'MXN' },
            trialsEndingSoon: [],
          },
        }),
      ),
    )
    const ov = await fetchSubscriptionOverview()
    expect(ov.counts.active).toBe(2)
    expect(ov.mrr.total).toBe(2317.68)
  })
  it('returns safe empty overview on malformed payload', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/subscriptions/overview`, () =>
        HttpResponse.json({ success: true }),
      ),
    )
    const ov = await fetchSubscriptionOverview()
    expect(ov.counts.total).toBe(0)
  })
})

describe('fetchVenueSubscriptions', () => {
  it('returns the data array + passes state/q params', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/subscriptions/venues`, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('state')).toBe('active')
        return HttpResponse.json({
          success: true,
          data: [
            {
              venueId: 'v1',
              name: 'X',
              slug: 'x',
              planTier: 'PRO',
              state: 'active',
              trialEndsAt: null,
              currentPeriodEnd: null,
              mrr: 1000,
              stripeSubscriptionId: 'sub_1',
              owner: { name: 'A', email: 'a@x.mx' },
            },
          ],
          meta: { total: 1, page: 1, pageSize: 25 },
        })
      }),
    )
    const rows = await fetchVenueSubscriptions({ state: 'active' })
    expect(rows).toHaveLength(1)
    expect(rows[0].state).toBe('active')
  })
  it('returns [] on malformed payload', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/subscriptions/venues`, () =>
        HttpResponse.json({ success: true }),
      ),
    )
    expect(await fetchVenueSubscriptions({})).toEqual([])
  })
})
