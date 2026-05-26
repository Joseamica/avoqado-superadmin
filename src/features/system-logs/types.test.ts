import { describe, expect, it } from 'vitest'
import {
  extractRequestSource,
  formatLogForClipboard,
  formatLogsForClipboard,
  humanizeLevel,
  humanizeRequestSource,
  humanizeType,
  LEVEL_TONE,
  parseLogMessage,
  prettyJson,
  stripAnsi,
  summarizeMessage,
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

/* ------------------------------------------------------------------ */
/*  Pure helpers — cada función se testea para ganar cobertura global  */
/* ------------------------------------------------------------------ */

describe('stripAnsi', () => {
  it('limpia secuencias de color ANSI', () => {
    expect(stripAnsi('\x1b[31merror\x1b[0m')).toBe('error')
  })

  it('no altera texto sin escape codes', () => {
    expect(stripAnsi('plain text')).toBe('plain text')
  })
})

describe('humanizeLevel', () => {
  it.each([
    ['info', 'Info'],
    ['warning', 'Advertencia'],
    ['error', 'Error'],
  ] as const)('mapea %s → %s', (level, expected) => {
    expect(humanizeLevel(level)).toBe(expected)
  })

  it('devuelve em-dash para null', () => {
    expect(humanizeLevel(null)).toBe('—')
  })
})

describe('humanizeType', () => {
  it.each([
    ['app', 'App'],
    ['request', 'Request'],
    ['build', 'Build'],
    ['deploy', 'Deploy'],
  ] as const)('mapea %s → %s', (type, expected) => {
    expect(humanizeType(type)).toBe(expected)
  })

  it('devuelve em-dash para null', () => {
    expect(humanizeType(null)).toBe('—')
  })
})

describe('humanizeRequestSource', () => {
  it.each([
    ['tpv', 'TPV'],
    ['mobile-pos', 'POS móvil'],
    ['dashboard', 'Dashboard'],
    ['superadmin', 'Superadmin'],
    ['consumer', 'Consumer'],
    ['webhook', 'Webhooks'],
    ['sdk', 'SDK'],
    ['sync', 'POS-Sync'],
    ['health', 'Salud'],
    ['other', 'Otros'],
  ] as const)('mapea %s → %s', (source, expected) => {
    expect(humanizeRequestSource(source)).toBe(expected)
  })
})

describe('LEVEL_TONE', () => {
  it('mapea niveles a tonos del design system', () => {
    expect(LEVEL_TONE.info).toBe('info')
    expect(LEVEL_TONE.warning).toBe('warn')
    expect(LEVEL_TONE.error).toBe('danger')
  })
})

describe('parseLogMessage', () => {
  it('extrae JSON trailing', () => {
    const result = parseLogMessage('DB Error {"code":"P2002","meta":{}}')
    expect(result.summary).toBe('DB Error')
    expect(result.json).toEqual({ code: 'P2002', meta: {} })
  })

  it('detecta línea completa JSON', () => {
    const result = parseLogMessage('{"message":"hello"}')
    expect(result.summary).toBe('(payload JSON — expande para ver)')
    expect(result.json).toEqual({ message: 'hello' })
  })

  it('devuelve null json cuando no hay JSON', () => {
    const result = parseLogMessage('Simple log')
    expect(result.json).toBeNull()
    expect(result.summary).toBe('Simple log')
  })

  it('primera línea como summary en multiline', () => {
    const result = parseLogMessage('Error at line 1\nStack trace\nat foo.js:3')
    expect(result.summary).toBe('Error at line 1')
    expect(result.fullMessage).toContain('Stack trace')
  })

  it('ignora llaves no-JSON', () => {
    const result = parseLogMessage('function() { return 42; }')
    // No debería parsear como JSON
    expect(result.json).toBeNull()
  })
})

describe('prettyJson', () => {
  it('formatea objeto', () => {
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}')
  })

  it('maneja circulares', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const result = prettyJson(circular)
    expect(typeof result).toBe('string')
  })
})

describe('summarizeMessage', () => {
  it('resume HTTP request line', () => {
    const result = summarizeMessage('Request End: POST /api/v1/tpv/payments - 201 [45.2ms]')
    expect(result).toContain('POST')
    expect(result).toContain('201')
    expect(result).toContain('45 ms')
  })

  it('detecta timeout', () => {
    const result = summarizeMessage('error: timeout of 30000ms exceeded')
    expect(result).toContain('30000 ms')
    expect(result).toContain('timeout')
  })

  it('detecta errores de red comunes', () => {
    expect(summarizeMessage('connect ECONNREFUSED 127.0.0.1')).toContain('rechazó la conexión')
    expect(summarizeMessage('read ECONNRESET')).toContain('se cortó')
    expect(summarizeMessage('connect ETIMEDOUT')).toContain('expiró')
    expect(summarizeMessage('getaddrinfo ENOTFOUND host.io')).toContain('DNS')
  })

  it('resume JSON con campo message', () => {
    const json = JSON.stringify({ message: 'Payment failed', orderId: '123' })
    const result = summarizeMessage(json)
    expect(result).toContain('Payment failed')
  })

  it('resume JSON con muchos campos', () => {
    const json = JSON.stringify({ message: 'hi', a: 1, b: 2, c: 3, d: 4 })
    const result = summarizeMessage(json)
    expect(result).toContain('4 campos')
  })

  it('resume JSON sin campo message', () => {
    const json = JSON.stringify({ foo: 'bar', baz: 42 })
    const result = summarizeMessage(json)
    expect(result).toContain('campo')
  })

  it('mantiene [TAG] prefix', () => {
    const result = summarizeMessage('[scheduler] Cron completed')
    expect(result).toContain('[scheduler]')
  })

  it('strip winston level prefix', () => {
    const result = summarizeMessage('info: Server started')
    expect(result).not.toMatch(/^info:/)
    expect(result).toContain('Server started')
  })

  it('detecta Prisma error', () => {
    const result = summarizeMessage(
      'Invalid `prisma.venue.findMany()` invocation:\nInvalid value for argument `take`. Expected Int',
    )
    expect(result).toContain('Prisma')
    expect(result).toContain('venue.findMany')
  })

  it('strip Unexpected Error prefix', () => {
    const result = summarizeMessage('Unexpected Error: something went wrong')
    expect(result).toContain('something went wrong')
    expect(result).not.toMatch(/^Unexpected Error/)
  })

  it('detecta Render API error', () => {
    const result = summarizeMessage('Render API 502: Bad gateway, CorrelationID: abc-123')
    expect(result).toContain('Render API respondió 502')
    expect(result).toContain('Bad gateway')
  })
})
