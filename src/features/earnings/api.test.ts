import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { fetchEarningsSummary, fetchEarningsTimeSeries } from './api'

const baseURL = 'http://localhost:3000/api/v1'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchEarningsSummary', () => {
  it('devuelve el resumen de earnings', async () => {
    const summary = { totalRevenue: 100, tpvRevenue: 60, onlineRevenue: 40 }
    server.use(
      http.get(`${baseURL}/superadmin/earnings/summary`, () =>
        HttpResponse.json({ success: true, data: summary }),
      ),
    )
    const result = await fetchEarningsSummary({})
    expect(result).toEqual(summary)
  })

  it('throwea con respuesta vacía', async () => {
    server.use(http.get(`${baseURL}/superadmin/earnings/summary`, () => HttpResponse.json({})))
    await expect(fetchEarningsSummary({})).rejects.toThrow('empty response')
  })
})

describe('fetchEarningsTimeSeries', () => {
  it('devuelve la serie temporal', async () => {
    const points = [{ date: '2026-05-01', amount: 50 }]
    server.use(
      http.get(`${baseURL}/superadmin/earnings/time-series`, () =>
        HttpResponse.json({ success: true, data: points }),
      ),
    )
    const result = await fetchEarningsTimeSeries({ granularity: 'daily' })
    expect(result).toHaveLength(1)
  })

  it('devuelve [] cuando data no es array', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/earnings/time-series`, () =>
        HttpResponse.json({ success: true }),
      ),
    )
    const result = await fetchEarningsTimeSeries({ granularity: 'daily' })
    expect(result).toEqual([])
  })
})
