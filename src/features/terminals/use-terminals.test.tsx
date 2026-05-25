import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { renderHook, waitFor } from '@testing-library/react'
import { AllProviders } from '@/test/render'
import {
  useAppVersions,
  useCreateTerminal,
  useDeleteTerminal,
  useGenerateActivationCode,
  useMerchantAccounts,
  useRemoteActivate,
  useTerminalCommand,
  useTerminalDetail,
  useTerminals,
  useTpvSettings,
  useUpdateTerminal,
  useUpdateTpvSettings,
} from './use-terminals'

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

describe('useTerminals', () => {
  it('devuelve la lista de terminals mapeada', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals`, () =>
        HttpResponse.json({ data: [rawTerminal], count: 1 }),
      ),
    )

    const { result } = renderHook(() => useTerminals(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].id).toBe('t1')
  })
})

describe('useTerminalDetail', () => {
  it('queda disabled cuando terminalId es undefined', () => {
    const { result } = renderHook(() => useTerminalDetail(undefined), { wrapper: AllProviders })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches el detalle cuando hay terminalId', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals/t1`, () =>
        HttpResponse.json({ data: rawTerminal }),
      ),
    )

    const { result } = renderHook(() => useTerminalDetail('t1'), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(result.current.data?.id).toBe('t1')
  })
})

describe('useTerminalCommand', () => {
  it('manda comando y resuelve con commandId', async () => {
    server.use(
      http.post(`${baseURL}/dashboard/tpv/t1/command`, () =>
        HttpResponse.json({ data: { commandId: 'cmd1', status: 'queued' } }),
      ),
    )

    const { result } = renderHook(() => useTerminalCommand(), { wrapper: AllProviders })

    const data = await result.current.mutateAsync({ terminalId: 't1', command: 'RESTART' })
    expect(data).toEqual({ commandId: 'cmd1', status: 'queued' })
  })
})

describe('useUpdateTerminal', () => {
  it('actualiza el terminal y resuelve con la response mapeada', async () => {
    server.use(
      http.patch(`${baseURL}/dashboard/superadmin/terminals/t1`, () =>
        HttpResponse.json({ data: { ...rawTerminal, name: 'TPV Cambiado' } }),
      ),
    )

    const { result } = renderHook(() => useUpdateTerminal(), { wrapper: AllProviders })

    const data = await result.current.mutateAsync({
      terminalId: 't1',
      payload: { name: 'TPV Cambiado' },
    })
    expect(data.name).toBe('TPV Cambiado')
  })
})

describe('useGenerateActivationCode', () => {
  it('genera código y resuelve', async () => {
    server.use(
      http.post(`${baseURL}/dashboard/superadmin/terminals/t1/generate-activation-code`, () =>
        HttpResponse.json({ data: { code: 'ABC123', expiresAt: '2026-06-01T00:00:00.000Z' } }),
      ),
    )

    const { result } = renderHook(() => useGenerateActivationCode(), { wrapper: AllProviders })

    const data = await result.current.mutateAsync('t1')
    expect(data.code).toBe('ABC123')
  })
})

describe('useRemoteActivate', () => {
  it('dispara la activación remota', async () => {
    let called = false
    server.use(
      http.post(`${baseURL}/dashboard/superadmin/terminals/t1/remote-activate`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )

    const { result } = renderHook(() => useRemoteActivate(), { wrapper: AllProviders })

    await result.current.mutateAsync('t1')
    expect(called).toBe(true)
  })
})

describe('useCreateTerminal', () => {
  it('crea un terminal y resuelve con la entidad nueva', async () => {
    server.use(
      http.post(`${baseURL}/dashboard/superadmin/terminals`, () =>
        HttpResponse.json({ data: rawTerminal }),
      ),
    )

    const { result } = renderHook(() => useCreateTerminal(), { wrapper: AllProviders })

    const data = await result.current.mutateAsync({
      venueId: 'v1',
      serialNumber: '1850072345',
      name: 'TPV Barra',
      type: 'TPV_ANDROID',
    })
    expect(data.id).toBe('t1')
  })
})

describe('useDeleteTerminal', () => {
  it('borra un terminal', async () => {
    let called = false
    server.use(
      http.delete(`${baseURL}/dashboard/superadmin/terminals/t1`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )

    const { result } = renderHook(() => useDeleteTerminal(), { wrapper: AllProviders })

    await result.current.mutateAsync('t1')
    expect(called).toBe(true)
  })
})

describe('useAppVersions', () => {
  it('devuelve la lista de versiones publicadas', async () => {
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
              releaseNotes: null,
              updateMode: 'NONE',
              createdAt: '2026-05-01T00:00:00.000Z',
              isActive: true,
            },
          ],
        }),
      ),
    )

    const { result } = renderHook(() => useAppVersions(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].versionName).toBe('1.42.0')
  })
})

describe('useMerchantAccounts', () => {
  it('devuelve las merchant accounts del onboarding endpoint', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/onboarding/merchant-accounts`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'm1',
              displayName: 'Cuenta Principal',
              alias: null,
              externalMerchantId: '9814275',
              provider: { name: 'Blumon' },
            },
          ],
        }),
      ),
    )

    const { result } = renderHook(() => useMerchantAccounts(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(result.current.data?.[0].providerName).toBe('Blumon')
  })
})

describe('useTpvSettings', () => {
  it('queda disabled cuando no hay terminalId', () => {
    const { result } = renderHook(() => useTpvSettings(undefined), { wrapper: AllProviders })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches settings con terminalId', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/tpv/t1/settings`, () =>
        HttpResponse.json({
          data: {
            showReviewScreen: true,
            showTipScreen: true,
            showReceiptScreen: false,
            defaultTipPercentage: 10,
            tipSuggestions: [],
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
            showReports: false,
            showPayments: false,
            showSupport: false,
            showGoals: false,
            showMessages: false,
            showTrainings: false,
            showCheckout: false,
            cellularFailoverMode: 'OFF',
            cellularFailoverBadReadingsThreshold: 3,
            cellularFailoverCooldownSeconds: 60,
            cellularFailoverMinCellHoldSeconds: 30,
          },
        }),
      ),
    )

    const { result } = renderHook(() => useTpvSettings('t1'), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(result.current.data?.showReviewScreen).toBe(true)
  })
})

describe('useUpdateTpvSettings', () => {
  it('actualiza un patch de settings y resuelve', async () => {
    server.use(
      http.put(`${baseURL}/dashboard/tpv/t1/settings`, () =>
        HttpResponse.json({ data: { showQuickPayment: false } as Record<string, unknown> }),
      ),
    )

    const { result } = renderHook(() => useUpdateTpvSettings(), { wrapper: AllProviders })

    const data = await result.current.mutateAsync({
      terminalId: 't1',
      patch: { showQuickPayment: false },
    })
    expect(data.showQuickPayment).toBe(false)
  })
})
