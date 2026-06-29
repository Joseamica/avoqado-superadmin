import { describe, it, expect } from 'vitest'
import {
  FORMA_PAGO_OPTIONS,
  USO_CFDI_OPTIONS,
  REGIMEN_FISCAL_OPTIONS,
  METODO_PAGO_OPTIONS,
  LINE_PRESETS,
  pesosToCents,
  centsToPesos,
  formatCents,
  fileToBase64,
  previewTotals,
} from './catalogs'

describe('catálogos SAT', () => {
  it('cada catálogo expone opciones con value/label y values únicos', () => {
    for (const opts of [
      FORMA_PAGO_OPTIONS,
      USO_CFDI_OPTIONS,
      REGIMEN_FISCAL_OPTIONS,
      METODO_PAGO_OPTIONS,
    ]) {
      expect(opts.length).toBeGreaterThan(0)
      const values = opts.map((o) => o.value)
      expect(new Set(values).size).toBe(values.length)
      for (const o of opts) {
        expect(o.value).toBeTruthy()
        expect(o.label).toBeTruthy()
      }
    }
  })

  it('incluye "99 · Por definir (PPD)" en formas de pago y PUE/PPD como métodos', () => {
    expect(FORMA_PAGO_OPTIONS.some((o) => o.value === '99')).toBe(true)
    expect(METODO_PAGO_OPTIONS.map((o) => o.value).sort()).toEqual(['PPD', 'PUE'])
  })

  it('el preset Mensualidad usa la clave SAT real (43232611) a 1599 + IVA', () => {
    const mensualidad = LINE_PRESETS.find((p) => p.key === 'mensualidad')
    expect(mensualidad?.line.satProductKey).toBe('43232611')
    expect(mensualidad?.line.unitPricePesos).toBe(1599)
    expect(mensualidad?.line.taxRate).toBe(0.16)
  })

  it('el preset Venta TPV existe con su clave SAT', () => {
    const tpv = LINE_PRESETS.find((p) => p.key === 'venta-tpv')
    expect(tpv?.line.satProductKey).toBe('43211902')
  })
})

describe('pesosToCents / centsToPesos', () => {
  it('convierte pesos a centavos redondeando al entero', () => {
    expect(pesosToCents(1599)).toBe(159900)
    expect(pesosToCents(18.5484)).toBe(1855)
    expect(pesosToCents(0)).toBe(0)
  })

  it('convierte centavos a pesos', () => {
    expect(centsToPesos(159900)).toBe(1599)
    expect(centsToPesos(1855)).toBe(18.55)
    expect(centsToPesos(0)).toBe(0)
  })

  it('round-trip estable para un monto entero de centavos', () => {
    expect(pesosToCents(centsToPesos(185484))).toBe(185484)
  })
})

describe('formatCents', () => {
  it('formatea centavos como moneda MXN', () => {
    const s = formatCents(185484)
    expect(s).toContain('1,854.84')
    expect(s).toContain('$')
  })

  it('formatea cero con dos decimales', () => {
    expect(formatCents(0)).toContain('0.00')
  })
})

describe('fileToBase64', () => {
  it('devuelve el base64 SIN el prefijo data:...;base64,', async () => {
    const file = new File(['hola'], 'constancia.txt', { type: 'text/plain' })
    const b64 = await fileToBase64(file)
    expect(b64).toBe('aG9sYQ==')
    expect(b64).not.toContain('data:')
    expect(b64).not.toContain(',')
  })
})

describe('previewTotals', () => {
  it('calcula subtotal e IVA (16% default) como add-on', () => {
    const t = previewTotals([{ quantity: 1, unitPriceCents: 159900 }])
    expect(t).toEqual({
      subtotalCents: 159900,
      discountCents: 0,
      taxCents: 25584,
      totalCents: 185484,
    })
  })

  it('aplica el descuento de línea antes de calcular el IVA', () => {
    const t = previewTotals([
      { quantity: 2, unitPriceCents: 10000, discountCents: 5000, taxRate: 0.16 },
    ])
    expect(t).toEqual({
      subtotalCents: 20000,
      discountCents: 5000,
      taxCents: 2400,
      totalCents: 17400,
    })
  })

  it('respeta taxExempt y suma varias líneas con tasas distintas', () => {
    const t = previewTotals([
      { quantity: 1, unitPriceCents: 10000, taxExempt: true },
      { quantity: 3, unitPriceCents: 5000, taxRate: 0.08 },
    ])
    expect(t.subtotalCents).toBe(25000)
    expect(t.taxCents).toBe(1200)
    expect(t.totalCents).toBe(26200)
  })

  it('devuelve ceros para una lista vacía', () => {
    expect(previewTotals([])).toEqual({
      subtotalCents: 0,
      discountCents: 0,
      taxCents: 0,
      totalCents: 0,
    })
  })
})
