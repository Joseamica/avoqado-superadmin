/**
 * Cobertura adicional para helpers de `types.ts` que no toca `types.test.ts`.
 * Aquí van `summarizeMessage`, `parseLogMessage`, `prettyJson`,
 * `humanizeLevel`, `humanizeType`, `humanizeRequestSource`, `stripAnsi`.
 */
import { describe, it, expect } from 'vitest'
import {
  humanizeLevel,
  humanizeRequestSource,
  humanizeType,
  parseLogMessage,
  prettyJson,
  stripAnsi,
  summarizeMessage,
} from './types'

describe('humanizeLevel', () => {
  it('maps known levels to Spanish labels', () => {
    expect(humanizeLevel('info')).toBe('Info')
    expect(humanizeLevel('warning')).toBe('Advertencia')
    expect(humanizeLevel('error')).toBe('Error')
  })

  it('returns em-dash for null', () => {
    expect(humanizeLevel(null)).toBe('—')
  })
})

describe('humanizeType', () => {
  it('maps known types to labels', () => {
    expect(humanizeType('app')).toBe('App')
    expect(humanizeType('request')).toBe('Request')
    expect(humanizeType('build')).toBe('Build')
    expect(humanizeType('deploy')).toBe('Deploy')
  })

  it('returns em-dash for null', () => {
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
  ] as const)('maps %s → %s', (input, expected) => {
    expect(humanizeRequestSource(input)).toBe(expected)
  })
})

describe('stripAnsi', () => {
  it('removes color escape codes from input', () => {
    expect(stripAnsi('[32minfo[0m: hola')).toBe('info: hola')
  })

  it('leaves plain text untouched', () => {
    expect(stripAnsi('plain text')).toBe('plain text')
  })
})

describe('parseLogMessage', () => {
  it('returns no JSON when the message is plain text', () => {
    const out = parseLogMessage('Server started on port 3000')
    expect(out.summary).toBe('Server started on port 3000')
    expect(out.json).toBeNull()
    expect(out.fullMessage).toBe('Server started on port 3000')
  })

  it('extracts trailing JSON from Winston-style messages', () => {
    const out = parseLogMessage('info: did the thing {"id": 5}')
    expect(out.json).toEqual({ id: 5 })
    expect(out.summary).toBe('info: did the thing')
  })

  it('parses a whole-line JSON object', () => {
    const out = parseLogMessage('{"foo": "bar"}')
    expect(out.json).toEqual({ foo: 'bar' })
    expect(out.summary).toMatch(/payload JSON/i)
  })

  it('ignores invalid JSON gracefully', () => {
    const out = parseLogMessage('text with {not-json: oops}')
    expect(out.json).toBeNull()
  })

  it('returns only the first line in the summary for multi-line input', () => {
    const out = parseLogMessage('one\ntwo\nthree')
    expect(out.summary).toBe('one')
    expect(out.fullMessage).toContain('two')
  })
})

describe('prettyJson', () => {
  it('pretty-prints normal values', () => {
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}')
  })

  it('falls back to String() for unsupported values', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const out = prettyJson(cyclic)
    expect(typeof out).toBe('string')
  })
})

describe('summarizeMessage', () => {
  it('summarizes HTTP request lines', () => {
    const out = summarizeMessage('Request End: GET /api/v1/tpv/payments - 200 [55ms]')
    expect(out).toMatch(/GET \/api\/v1\/tpv\/payments → 200 \(55 ms\)/)
  })

  it('strips Winston level prefixes', () => {
    expect(summarizeMessage('info: hola mundo')).toBe('hola mundo')
  })

  it('detects ECONNREFUSED and produces a human message', () => {
    expect(summarizeMessage('Error: ECONNREFUSED 127.0.0.1')).toMatch(/rechazó la conexión/i)
  })

  it('detects timeout messages', () => {
    expect(summarizeMessage('Error: timeout of 5000ms exceeded')).toMatch(/timeout/i)
  })

  it('extracts a Prisma invalid invocation', () => {
    const out = summarizeMessage('Invalid `prisma.user.create()` invocation: arg blew up')
    expect(out).toMatch(/prisma\.user\.create\(\)/)
  })

  it('summarizes whole-line JSON with message field', () => {
    const out = summarizeMessage('{"message":"hola","extra":1}')
    expect(out).toMatch(/hola/)
  })

  it('summarizes JSON without a message field', () => {
    const out = summarizeMessage('{"foo":1,"bar":2}')
    expect(out).toMatch(/JSON con 2 campos/)
  })

  it('strips trailing correlation IDs', () => {
    const out = summarizeMessage('info: oops, CorrelationID: abc-123')
    expect(out).not.toMatch(/CorrelationID/)
  })

  it('preserves [TAG] prefixes when present', () => {
    expect(summarizeMessage('[WORKER] processing job')).toMatch(/\[WORKER\] processing job/)
  })
})
