import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { applyRateCorrection, previewRateCorrection } from './api'
import type { RateCorrectionParams } from './api'

const baseURL = 'http://localhost:3000/api/v1'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const params: RateCorrectionParams = {
  accountType: 'PRIMARY',
  missingCostMode: 'FIX_PAYMENT_ONLY',
}

describe('previewRateCorrection', () => {
  it('devuelve el preview sin envolver (data.data unwrapped)', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/rate-corrections/venues/v1/preview`, () =>
        HttpResponse.json({
          data: {
            merchantAccountId: 'ma1',
            inScopeCount: 3,
            withCostCount: 2,
            missingCostCount: 1,
            beforeFeeTotal: 100,
            afterFeeTotal: 95,
            estimatedImpact: -5,
            negativeMarginCount: 0,
            costStructureAvailable: true,
            venuePricingAvailable: true,
          },
        }),
      ),
    )

    const result = await previewRateCorrection('v1', params)
    expect(result.inScopeCount).toBe(3)
    expect(result.merchantAccountId).toBe('ma1')
    expect(result.costStructureAvailable).toBe(true)
    expect(result.estimatedImpact).toBe(-5)
  })
})

describe('applyRateCorrection', () => {
  it('devuelve el batch sin envolver (data.data unwrapped)', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/rate-corrections/venues/v1/apply`, () =>
        HttpResponse.json({
          data: {
            id: 'b1',
            venueId: 'v1',
            merchantAccountId: 'ma1',
            accountType: 'PRIMARY',
            status: 'APPLIED',
            paymentCount: 3,
            costCreatedCount: 1,
            estimatedImpact: -5,
            appliedAt: '2026-05-26T00:00:00.000Z',
            reversedAt: null,
            createdAt: '2026-05-26T00:00:00.000Z',
          },
        }),
      ),
    )

    const result = await applyRateCorrection('v1', params)
    expect(result.id).toBe('b1')
    expect(result.status).toBe('APPLIED')
    expect(result.paymentCount).toBe(3)
  })
})
