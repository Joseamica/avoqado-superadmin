import { describe, expect, it } from 'vitest'
import { centsToLabel, pesosInputToCents } from './money'

describe('pesosInputToCents', () => {
  it('convierte pesos enteros a centavos', () => {
    expect(pesosInputToCents('22')).toBe(2200)
    expect(pesosInputToCents('999')).toBe(99900)
  })

  it('convierte decimales a centavos', () => {
    expect(pesosInputToCents('22.5')).toBe(2250)
    expect(pesosInputToCents('1158.84')).toBe(115884)
    expect(pesosInputToCents('18.97')).toBe(1897)
  })

  /**
   * 🔴 La aritmética va por STRING, no por `Number(x) * 100`.
   * `18.97 * 100` vale 1896.9999999999998 en binario y `22.005 * 100` vale
   * 2200.4999999999998: redondear el flotante da el centavo de abajo y el
   * precio que se anuncia deja de ser el que se cobra.
   */
  it('redondea al centavo sin pasar por el flotante', () => {
    // 🔴 Estos tres valores DISCRIMINAN: con `Math.round(Number(x) * 100)` el
    // doble se redondea antes de multiplicar y devuelve el centavo de abajo
    // (1007, 1015, 1602). Se eligieron barriendo los 300 000 valores de tres
    // decimales y quedándose con los que las dos aritméticas contestan distinto
    // — con 22.005 o 18.97, que era el primer intento, las dos coinciden por
    // casualidad y la prueba pasaba sin ejercitar nada.
    expect(pesosInputToCents('10.075')).toBe(1008)
    expect(pesosInputToCents('10.155')).toBe(1016)
    expect(pesosInputToCents('16.025')).toBe(1603)
    // Y el redondeo normal sigue siendo el de siempre.
    expect(pesosInputToCents('22.004')).toBe(2200)
    expect(pesosInputToCents('22.006')).toBe(2201)
  })

  it('tolera el símbolo, los espacios y los separadores de miles', () => {
    expect(pesosInputToCents(' $1,158.84 ')).toBe(115884)
  })

  it('rechaza lo que no es un número', () => {
    expect(() => pesosInputToCents('abc')).toThrow()
    expect(() => pesosInputToCents('')).toThrow()
    expect(() => pesosInputToCents('.')).toThrow()
    expect(() => pesosInputToCents('22.5.1')).toThrow()
    expect(() => pesosInputToCents('22 pesos')).toThrow()
  })
})

describe('centsToLabel', () => {
  it('pinta el monto en pesos mexicanos', () => {
    expect(centsToLabel(115884)).toBe('$1,158.84')
    expect(centsToLabel(2200)).toBe('$22.00')
    expect(centsToLabel(0)).toBe('$0.00')
  })

  it('un monto ausente se lee como raya, no como cero', () => {
    expect(centsToLabel(null)).toBe('—')
    expect(centsToLabel(undefined)).toBe('—')
  })
})
