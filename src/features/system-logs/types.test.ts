import { describe, expect, it } from 'vitest'
import {
  extractRequestSource,
  formatLogForClipboard,
  formatLogsForClipboard,
  type SystemLogEntry,
} from './types'

/**
 * Tests para `extractRequestSource` — la función que mapea un mensaje de log
 * de Render a la categoría de cliente que lo originó. Mantiene honesta la
 * tabla de prefixes contra `avoqado-server/src/routes/index.ts`: si el
 * backend agrega un mount nuevo y olvidamos categorizarlo aquí, este
 * archivo es donde lo notamos.
 */
describe('extractRequestSource', () => {
  it.each([
    ['Request End: GET /api/v1/tpv/payments - 200 [123ms]', 'tpv'],
    ['Request End: POST /api/v1/mobile/orders - 201 [45ms]', 'mobile-pos'],
    ['Request End: GET /api/v1/dashboard/venues - 200 [80ms]', 'dashboard'],
    ['Request End: GET /api/v1/analytics/cohorts - 200 [340ms]', 'dashboard'],
    ['Request End: GET /api/v1/organizations/abc/staff - 200 [50ms]', 'dashboard'],
    ['Request End: GET /api/v1/me - 200 [12ms]', 'dashboard'],
    ['Request End: GET /api/v1/superadmin/system-logs - 200 [200ms]', 'superadmin'],
    ['Request End: GET /api/v1/consumer/venues/abc - 200 [30ms]', 'consumer'],
    ['Request End: POST /api/v1/webhooks/stripe - 200 [100ms]', 'webhook'],
    ['Request End: POST /api/v1/integrations/mercadopago/callback - 200 [80ms]', 'webhook'],
    ['Request End: POST /api/v1/google-calendar/sync - 200 [120ms]', 'webhook'],
    ['Request End: POST /api/v1/sdk/charges - 200 [90ms]', 'sdk'],
    ['Request End: POST /api/v1/pos-sync/heartbeat - 200 [20ms]', 'sync'],
    ['Request End: GET /api/v1/onboarding/step/1 - 200 [25ms]', 'other'],
    ['Request End: GET /api/v1/invitations/abc - 200 [15ms]', 'other'],
    ['Request End: GET /api/v1/partner/ping - 200 [10ms]', 'other'],
    ['Request End: GET /api/v1/public/menu - 200 [40ms]', 'other'],
    ['Request End: GET /health - 200 [2ms]', 'health'],
    ['Request End: GET /api/public/healthcheck - 200 [5ms]', 'health'],
    ['Request End: GET /api/public/metrics - 200 [3ms]', 'health'],
  ])('mapea %s → %s', (message, expected) => {
    expect(extractRequestSource(message)).toBe(expected)
  })

  it('devuelve null para mensajes sin path', () => {
    expect(extractRequestSource('Server started on port 3000')).toBeNull()
    expect(extractRequestSource('Stripe webhook signature verified')).toBeNull()
    expect(extractRequestSource('[WORKER] processing job')).toBeNull()
  })

  it('detecta el path aunque venga embebido en texto natural', () => {
    expect(
      extractRequestSource('Error processing /api/v1/tpv/payments — DB timeout exceeded'),
    ).toBe('tpv')
    expect(extractRequestSource('warn: Slow query on /api/v1/dashboard/orders/list (1240ms)')).toBe(
      'dashboard',
    )
  })

  it('ignora secuencias ANSI', () => {
    // Render entrega los logs con escape codes de color terminal a veces.
    expect(extractRequestSource('[32minfo[0m: GET /api/v1/superadmin/venues')).toBe('superadmin')
  })

  it('toma el primer path cuando hay varios', () => {
    // Útil para mensajes como "Redirect from /api/v1/old to /api/v1/dashboard/new"
    expect(
      extractRequestSource('Forwarding /api/v1/tpv/legacy to /api/v1/dashboard/replacement'),
    ).toBe('tpv')
  })
})

const mkLog = (overrides: Partial<SystemLogEntry> = {}): SystemLogEntry => ({
  id: 'log-1',
  timestamp: '2026-05-26T14:30:05.123Z',
  message: 'Request End: GET /api/v1/superadmin/venues - 200 [45ms]',
  level: 'info',
  type: 'app',
  labels: [],
  ...overrides,
})

describe('formatLogForClipboard', () => {
  it('formatea con timestamp, level, type y mensaje', () => {
    const result = formatLogForClipboard(mkLog())
    expect(result).toBe(
      '2026-05-26 14:30:05 [INFO] [App] Request End: GET /api/v1/superadmin/venues - 200 [45ms]',
    )
  })

  it('omite level y type cuando son null', () => {
    const result = formatLogForClipboard(mkLog({ level: null, type: null }))
    expect(result).toBe(
      '2026-05-26 14:30:05 Request End: GET /api/v1/superadmin/venues - 200 [45ms]',
    )
  })

  it('toma solo la primera línea de un stack trace', () => {
    const result = formatLogForClipboard(
      mkLog({ message: 'Error: boom\n    at foo.js:1\n    at bar.js:2', level: 'error' }),
    )
    expect(result).toContain('Error: boom')
    expect(result).not.toContain('at foo')
  })
})

describe('formatLogsForClipboard', () => {
  it('devuelve placeholder cuando no hay logs', () => {
    expect(formatLogsForClipboard([])).toBe('(sin logs visibles)')
  })

  it('incluye header con conteo y rango de timestamps', () => {
    const logs = [
      mkLog({ timestamp: '2026-05-26T14:30:10.000Z' }),
      mkLog({ timestamp: '2026-05-26T14:30:05.000Z' }),
    ]
    const result = formatLogsForClipboard(logs)
    const lines = result.split('\n')
    expect(lines[0]).toMatch(/^--- 2 logs/)
    expect(lines[0]).toContain('14:30:05')
    expect(lines[0]).toContain('14:30:10')
    expect(lines).toHaveLength(3) // header + 2 log lines
  })
})
