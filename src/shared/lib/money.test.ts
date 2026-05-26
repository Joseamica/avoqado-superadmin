import { describe, it, expect } from 'vitest'
import { formatMoney, formatCompactMoney } from './money'

describe('formatMoney', () => {
  it('formats MXN with 2 decimals and grouping', () => {
    expect(formatMoney(128450.2)).toBe('$128,450.20')
  })
  it('treats null/undefined as 0', () => {
    expect(formatMoney(null)).toBe('$0.00')
  })
})

describe('formatCompactMoney', () => {
  it('abbreviates large amounts with a leading $', () => {
    expect(formatCompactMoney(4200000)).toBe('$4.2M')
  })
  it('places the sign before the $ for negatives', () => {
    expect(formatCompactMoney(-1200)).toBe('-$1.2K')
  })
  it('treats null/undefined as $0', () => {
    expect(formatCompactMoney(null)).toBe('$0')
  })
})
