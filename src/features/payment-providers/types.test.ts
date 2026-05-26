import { describe, it, expect } from 'vitest'
import {
  humanizeProviderType,
  inferTemplateFromCode,
  PROVIDER_TEMPLATES,
  PROVIDER_TYPE_TONE,
  COUNTRY_OPTIONS,
} from './types'

describe('humanizeProviderType', () => {
  it('mapea cada tipo a su label legible', () => {
    expect(humanizeProviderType('PAYMENT_PROCESSOR')).toBe('Procesador de pagos')
    expect(humanizeProviderType('BANK_DIRECT')).toBe('Banco directo')
    expect(humanizeProviderType('WALLET')).toBe('Wallet')
    expect(humanizeProviderType('GATEWAY')).toBe('Gateway')
    expect(humanizeProviderType('OTHER')).toBe('Otro')
  })
})

describe('PROVIDER_TYPE_TONE', () => {
  it('tiene un tono para cada tipo', () => {
    expect(PROVIDER_TYPE_TONE.PAYMENT_PROCESSOR).toBe('accent')
    expect(PROVIDER_TYPE_TONE.BANK_DIRECT).toBe('info')
    expect(PROVIDER_TYPE_TONE.OTHER).toBe('muted')
  })
})

describe('inferTemplateFromCode', () => {
  it('matchea BLUMON case-insensitive', () => {
    expect(inferTemplateFromCode('blumon')?.key).toBe('blumon')
    expect(inferTemplateFromCode('BLUMON')?.key).toBe('blumon')
    expect(inferTemplateFromCode(' Blumon ')?.key).toBe('blumon')
  })

  it('matchea otros providers', () => {
    expect(inferTemplateFromCode('ANGELPAY')?.key).toBe('angelpay')
    expect(inferTemplateFromCode('STRIPE')?.key).toBe('stripe')
    expect(inferTemplateFromCode('MENTA')?.key).toBe('menta')
  })

  it('devuelve undefined para código vacío o desconocido', () => {
    expect(inferTemplateFromCode('')).toBeUndefined()
    expect(inferTemplateFromCode('  ')).toBeUndefined()
    expect(inferTemplateFromCode('UNKNOWN_PROVIDER')).toBeUndefined()
  })
})

describe('PROVIDER_TEMPLATES', () => {
  it('incluye al menos blumon, angelpay, stripe y custom', () => {
    const keys = PROVIDER_TEMPLATES.map((t) => t.key)
    expect(keys).toContain('blumon')
    expect(keys).toContain('angelpay')
    expect(keys).toContain('stripe')
    expect(keys).toContain('custom')
  })

  it('custom template tiene defaults vacíos', () => {
    const custom = PROVIDER_TEMPLATES.find((t) => t.key === 'custom')!
    expect(custom.defaults.code).toBe('')
    expect(custom.defaults.name).toBe('')
    expect(custom.defaults.configSchema).toBeNull()
  })
})

describe('COUNTRY_OPTIONS', () => {
  it('incluye México como primer país', () => {
    expect(COUNTRY_OPTIONS[0]).toEqual({ code: 'MX', name: 'México' })
  })

  it('cada opción tiene code y name', () => {
    for (const opt of COUNTRY_OPTIONS) {
      expect(opt.code).toBeTruthy()
      expect(opt.name).toBeTruthy()
    }
  })
})
