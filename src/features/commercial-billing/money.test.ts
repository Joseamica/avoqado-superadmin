import { describe, expect, it } from 'vitest'
import { formatMinorUnits } from './money'

describe('formatMinorUnits', () => {
  it('formats MXN minor units without converting through Number', () => {
    expect(formatMinorUnits('2500000', 'MXN')).toBe('$25,000.00')
    expect(formatMinorUnits('900719925474099300', 'MXN')).toBe('$9,007,199,254,740,993.00')
  })

  it('keeps sign and cents exact', () => {
    expect(formatMinorUnits('-105', 'MXN')).toBe('-$1.05')
    expect(formatMinorUnits('5', 'USD')).toBe('USD 0.05')
  })

  it('rejects malformed amounts and unsupported currency codes', () => {
    expect(() => formatMinorUnits('12.50', 'MXN')).toThrow('Importe menor inválido')
    expect(() => formatMinorUnits('1250', 'mxn')).toThrow('Moneda inválida')
  })
})
