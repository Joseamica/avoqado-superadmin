import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  createTerminal,
  deleteTerminal,
  fetchAppVersions,
  fetchMerchantAccounts,
  fetchTerminalDetail,
  fetchTerminals,
  fetchTpvSettings,
  generateActivationCode,
  remoteActivate,
  sendCommand,
  updateTerminal,
  updateTpvSettings,
} from './api'

const baseURL = 'http://localhost:3000/api/v1'

const rawTerminal = {
  id: 't1',
  serialNumber: '1850072345',
  name: 'TPV Barra',
  type: 'TPV_ANDROID' as const,
  brand: 'PAX',
  model: 'A910s',
  status: 'ACTIVE' as const,
  lastHeartbeat: '2026-05-25T10:00:00.000Z',
  version: '1.42.0',
  latestHealthScore: 85,
  latestHealthAt: '2026-05-25T10:00:00.000Z',
  ipAddress: '192.168.1.10',
  isLocked: false,
  lockedAt: null,
  lockedReason: null,
  assignedMerchantIds: ['m1'],
  activationCode: null,
  activationCodeExpiry: null,
  activatedAt: '2026-01-01T00:00:00.000Z',
  venueId: 'v1',
  venue: { id: 'v1', name: 'Pez Volador', slug: 'pez-volador' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-05-25T10:00:00.000Z',
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchTerminals', () => {
  it('lista terminals mapeando la raw response y default isLocked a false', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals`, () =>
        HttpResponse.json({
          data: [{ ...rawTerminal, isLocked: undefined, assignedMerchantIds: undefined }],
          count: 1,
        }),
      ),
    )

    const result = await fetchTerminals()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 't1',
      name: 'TPV Barra',
      isLocked: false,
      assignedMerchantIds: [],
    })
  })

  it('devuelve [] cuando la response no tiene `data`', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals`, () => HttpResponse.json({ count: 0 })),
    )

    const result = await fetchTerminals()
    expect(result).toEqual([])
  })

  it('forwarda params como query string', async () => {
    let receivedUrl: URL | null = null
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals`, ({ request }) => {
        receivedUrl = new URL(request.url)
        return HttpResponse.json({ data: [], count: 0 })
      }),
    )

    await fetchTerminals({ venueId: 'v1', status: 'ACTIVE' })
    expect(receivedUrl).not.toBeNull()
    expect(receivedUrl!.searchParams.get('venueId')).toBe('v1')
    expect(receivedUrl!.searchParams.get('status')).toBe('ACTIVE')
  })

  it('lanza error cuando el server responde 500', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )

    await expect(fetchTerminals()).rejects.toThrow()
  })
})

describe('fetchTerminalDetail', () => {
  it('devuelve la terminal mapeada cuando existe', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals/t1`, () =>
        HttpResponse.json({ data: rawTerminal }),
      ),
    )

    const result = await fetchTerminalDetail('t1')
    expect(result?.id).toBe('t1')
    expect(result?.name).toBe('TPV Barra')
    expect(result?.brand).toBe('PAX')
  })

  it('devuelve null en 404 (no throw)', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals/missing`, () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 }),
      ),
    )

    const result = await fetchTerminalDetail('missing')
    expect(result).toBeNull()
  })

  it('throwea cuando el error NO es 404', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals/bad`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )

    await expect(fetchTerminalDetail('bad')).rejects.toThrow()
  })

  it('devuelve null si data viene sin data wrapper', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals/empty`, () => HttpResponse.json({})),
    )
    const result = await fetchTerminalDetail('empty')
    expect(result).toBeNull()
  })
})

describe('updateTerminal', () => {
  it('manda PATCH con el payload y devuelve la terminal actualizada', async () => {
    let receivedBody: unknown = null
    server.use(
      http.patch(`${baseURL}/dashboard/superadmin/terminals/t1`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({ data: { ...rawTerminal, name: 'TPV Barra Renombrada' } })
      }),
    )

    const result = await updateTerminal('t1', { name: 'TPV Barra Renombrada' })
    expect(receivedBody).toEqual({ name: 'TPV Barra Renombrada' })
    expect(result.name).toBe('TPV Barra Renombrada')
  })

  it('rejects cuando el server responde error', async () => {
    server.use(
      http.patch(`${baseURL}/dashboard/superadmin/terminals/t1`, () =>
        HttpResponse.json({ message: 'invalid' }, { status: 400 }),
      ),
    )

    await expect(updateTerminal('t1', { name: 'X' })).rejects.toThrow()
  })
})

describe('generateActivationCode', () => {
  it('devuelve el código generado', async () => {
    server.use(
      http.post(`${baseURL}/dashboard/superadmin/terminals/t1/generate-activation-code`, () =>
        HttpResponse.json({
          data: { code: 'A3F9K2', expiresAt: '2026-06-01T00:00:00.000Z' },
        }),
      ),
    )

    const result = await generateActivationCode('t1')
    expect(result.code).toBe('A3F9K2')
    expect(result.expiresAt).toBe('2026-06-01T00:00:00.000Z')
  })
})

describe('remoteActivate', () => {
  it('hace POST sin payload y resuelve sin valor', async () => {
    let called = false
    server.use(
      http.post(`${baseURL}/dashboard/superadmin/terminals/t1/remote-activate`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )

    await expect(remoteActivate('t1')).resolves.toBeUndefined()
    expect(called).toBe(true)
  })
})

describe('sendCommand', () => {
  it('manda command + payload y devuelve commandId/status', async () => {
    let receivedBody: unknown = null
    server.use(
      http.post(`${baseURL}/dashboard/tpv/t1/command`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({ data: { commandId: 'cmd1', status: 'queued' } })
      }),
    )

    const result = await sendCommand('t1', 'RESTART', { foo: 'bar' })
    expect(receivedBody).toEqual({ command: 'RESTART', payload: { foo: 'bar' } })
    expect(result).toEqual({ commandId: 'cmd1', status: 'queued' })
  })

  it('devuelve fallback queued cuando el server no manda data', async () => {
    server.use(http.post(`${baseURL}/dashboard/tpv/t1/command`, () => HttpResponse.json({})))

    const result = await sendCommand('t1', 'CLEAR_CACHE')
    expect(result).toEqual({ commandId: '', status: 'queued' })
  })
})

describe('deleteTerminal', () => {
  it('hace DELETE y resuelve', async () => {
    let called = false
    server.use(
      http.delete(`${baseURL}/dashboard/superadmin/terminals/t1`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )

    await expect(deleteTerminal('t1')).resolves.toBeUndefined()
    expect(called).toBe(true)
  })
})

describe('createTerminal', () => {
  it('hace POST y mapea activationCode/expiry a null cuando no llegan', async () => {
    server.use(
      http.post(`${baseURL}/dashboard/superadmin/terminals`, () =>
        HttpResponse.json({ data: rawTerminal }),
      ),
    )

    const result = await createTerminal({
      venueId: 'v1',
      serialNumber: '1850072345',
      name: 'TPV Barra',
      type: 'TPV_ANDROID',
    })

    expect(result.id).toBe('t1')
    expect(result.activationCode).toBeNull()
    expect(result.activationCodeExpiry).toBeNull()
  })

  it('cuando el server devuelve activationCode, lo pasa al resultado', async () => {
    server.use(
      http.post(`${baseURL}/dashboard/superadmin/terminals`, () =>
        HttpResponse.json({
          data: {
            ...rawTerminal,
            activationCode: 'A3F9K2',
            activationCodeExpiry: '2026-06-01T00:00:00.000Z',
          },
        }),
      ),
    )

    const result = await createTerminal({
      venueId: 'v1',
      serialNumber: '1850072345',
      name: 'TPV Barra',
      type: 'TPV_ANDROID',
      generateActivationCode: true,
    })

    expect(result.activationCode).toBe('A3F9K2')
    expect(result.activationCodeExpiry).toBe('2026-06-01T00:00:00.000Z')
  })
})

describe('fetchMerchantAccounts', () => {
  it('mapea raw merchant accounts a opciones del selector', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/onboarding/merchant-accounts`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'm1',
              displayName: 'Cuenta Principal',
              alias: 'Sucursal Centro',
              externalMerchantId: '9814275',
              provider: { name: 'Blumon' },
            },
            {
              id: 'm2',
              displayName: 'Cuenta Secundaria',
              alias: null,
              externalMerchantId: null,
              provider: null,
            },
          ],
        }),
      ),
    )

    const result = await fetchMerchantAccounts()
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'm1',
      displayName: 'Cuenta Principal',
      alias: 'Sucursal Centro',
      externalMerchantId: '9814275',
      providerName: 'Blumon',
    })
    // Cuando no hay provider, usa el em-dash
    expect(result[1].providerName).toBe('—')
  })

  it('devuelve [] cuando data viene undefined', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/onboarding/merchant-accounts`, () => HttpResponse.json({})),
    )
    const result = await fetchMerchantAccounts()
    expect(result).toEqual([])
  })
})

describe('fetchTpvSettings', () => {
  const sampleSettings = {
    showReviewScreen: true,
    showTipScreen: true,
    showReceiptScreen: false,
    defaultTipPercentage: 10,
    tipSuggestions: [10, 15, 20],
    requirePinLogin: false,
    requireClockInToLogin: false,
    requireClockInPhoto: false,
    requireClockOutPhoto: false,
    showVerificationScreen: false,
    requireVerificationPhoto: false,
    requireVerificationBarcode: false,
    kioskModeEnabled: false,
    kioskDefaultMerchantId: null,
    showQuickPayment: true,
    showOrderManagement: true,
    showReports: true,
    showPayments: true,
    showSupport: false,
    showGoals: false,
    showMessages: false,
    showTrainings: false,
    showCheckout: true,
    cellularFailoverMode: 'OFF' as const,
    cellularFailoverBadReadingsThreshold: 3,
    cellularFailoverCooldownSeconds: 60,
    cellularFailoverMinCellHoldSeconds: 30,
  }

  it('desenvuelve respuesta con `{ data: settings }` wrapper', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/tpv/t1/settings`, () =>
        HttpResponse.json({ data: sampleSettings }),
      ),
    )

    const result = await fetchTpvSettings('t1')
    expect(result.showReviewScreen).toBe(true)
    expect(result.tipSuggestions).toEqual([10, 15, 20])
  })

  it('acepta también response sin wrapper (objeto directo)', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/tpv/t1/settings`, () => HttpResponse.json(sampleSettings)),
    )

    const result = await fetchTpvSettings('t1')
    expect(result.showReviewScreen).toBe(true)
  })
})

describe('updateTpvSettings', () => {
  it('manda PUT con el patch y desenvuelve la response', async () => {
    let receivedBody: unknown = null
    server.use(
      http.put(`${baseURL}/dashboard/tpv/t1/settings`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({
          data: { showQuickPayment: false } as Record<string, unknown>,
        })
      }),
    )

    const result = await updateTpvSettings('t1', { showQuickPayment: false })
    expect(receivedBody).toEqual({ showQuickPayment: false })
    expect(result.showQuickPayment).toBe(false)
  })
})

describe('fetchAppVersions', () => {
  it('mapea la lista de versiones del backend', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/app-updates`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'v1',
              versionName: '1.42.0',
              versionCode: 142,
              environment: 'PRODUCTION',
              releaseNotes: 'Bug fixes',
              updateMode: 'NONE',
              createdAt: '2026-05-01T00:00:00.000Z',
              isActive: true,
            },
          ],
        }),
      ),
    )

    const result = await fetchAppVersions()
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'v1',
      versionName: '1.42.0',
      versionCode: 142,
      environment: 'PRODUCTION',
      releaseNotes: 'Bug fixes',
      updateMode: 'NONE',
      createdAt: '2026-05-01T00:00:00.000Z',
      isActive: true,
    })
  })

  it('devuelve [] cuando la response no es un array', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/app-updates`, () =>
        HttpResponse.json({ success: true }),
      ),
    )

    const result = await fetchAppVersions()
    expect(result).toEqual([])
  })
})
