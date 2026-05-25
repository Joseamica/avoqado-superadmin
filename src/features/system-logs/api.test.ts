import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { fetchSystemLogs } from './api'

const baseURL = 'http://localhost:3000/api/v1'

const server = setupServer(
  http.get(`${baseURL}/superadmin/system-logs`, ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json({
      success: true,
      data: {
        enabled: true,
        logs: [
          {
            id: 'log-1',
            timestamp: '2026-01-01T12:00:00.000Z',
            message: 'hello',
            level: url.searchParams.get('level') ?? 'info',
            type: url.searchParams.get('type') ?? 'app',
            labels: [],
          },
        ],
        hasMore: false,
        // Echo back so we can assert the params survived `cleanParams`
        _echo: {
          level: url.searchParams.get('level'),
          type: url.searchParams.get('type'),
          search: url.searchParams.get('search'),
          limit: url.searchParams.get('limit'),
        },
      },
    })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchSystemLogs', () => {
  it('unwraps the server envelope and returns the inner payload', async () => {
    const result = await fetchSystemLogs({})
    expect(result.enabled).toBe(true)
    expect(result.logs).toHaveLength(1)
    expect(result.logs[0].id).toBe('log-1')
  })

  it('drops undefined / null / empty-string params before sending', async () => {
    const result = (await fetchSystemLogs({
      level: 'error',
      type: undefined,
      search: '',
      limit: 25,
    })) as unknown as { _echo: Record<string, string | null> }

    expect(result._echo.level).toBe('error')
    expect(result._echo.type).toBeNull()
    expect(result._echo.search).toBeNull()
    expect(result._echo.limit).toBe('25')
  })

  it('handles the default empty params call', async () => {
    const result = await fetchSystemLogs()
    expect(result.logs).toHaveLength(1)
  })
})
