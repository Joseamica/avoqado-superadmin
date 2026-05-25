import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { fetchActivityLog, fetchActivityLogActions, fetchActivityLogEntities } from './api'

const baseURL = 'http://localhost:3000/api/v1'

const server = setupServer(
  http.get(`${baseURL}/superadmin/activity-log`, ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json({
      success: true,
      data: {
        logs: [
          {
            id: 'log-1',
            action: 'LOGIN',
            entity: 'Staff',
            entityId: 'st_1',
            data: {},
            ipAddress: '127.0.0.1',
            createdAt: '2026-01-01T00:00:00.000Z',
            staff: { id: 'st_1', firstName: 'Ada', lastName: 'L' },
            venueId: null,
            venueName: null,
            organizationName: null,
          },
        ],
        pagination: {
          page: Number(url.searchParams.get('page') ?? 1),
          pageSize: Number(url.searchParams.get('pageSize') ?? 50),
          total: 1,
          totalPages: 1,
        },
        _echo: {
          action: url.searchParams.get('action'),
          search: url.searchParams.get('search'),
          page: url.searchParams.get('page'),
        },
      },
    })
  }),
  http.get(`${baseURL}/superadmin/activity-log/actions`, () =>
    HttpResponse.json({ success: true, data: ['LOGIN', 'LOGOUT'] }),
  ),
  http.get(`${baseURL}/superadmin/activity-log/entities`, () =>
    HttpResponse.json({ success: true, data: ['Staff', 'Venue'] }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchActivityLog', () => {
  it('unwraps the envelope to ActivityLogResponse', async () => {
    const result = await fetchActivityLog({})
    expect(result.logs).toHaveLength(1)
    expect(result.pagination.total).toBe(1)
  })

  it('drops empty / undefined params before issuing the request', async () => {
    const result = (await fetchActivityLog({
      action: '',
      search: undefined,
      page: 2,
    })) as unknown as { _echo: Record<string, string | null> }
    expect(result._echo.action).toBeNull()
    expect(result._echo.search).toBeNull()
    expect(result._echo.page).toBe('2')
  })
})

describe('fetchActivityLogActions', () => {
  it('returns the unwrapped list', async () => {
    const list = await fetchActivityLogActions()
    expect(list).toEqual(['LOGIN', 'LOGOUT'])
  })
})

describe('fetchActivityLogEntities', () => {
  it('returns the unwrapped list', async () => {
    const list = await fetchActivityLogEntities()
    expect(list).toEqual(['Staff', 'Venue'])
  })
})
