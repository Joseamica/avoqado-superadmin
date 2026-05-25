import { describe, it, expect } from 'vitest'
import { isProviderCompatible } from './payment-compat'

describe('isProviderCompatible', () => {
  it('Blumon requiere PAX', () => {
    expect(isProviderCompatible('BLUMON', ['PAX'])).toBe(true)
    expect(isProviderCompatible('BLUMON', ['NEXGO'])).toBe(false)
  })
  it('AngelPay requiere NEXGO', () => {
    expect(isProviderCompatible('ANGELPAY', ['NEXGO'])).toBe(true)
    expect(isProviderCompatible('ANGELPAY', [])).toBe(false)
  })
  it('proveedor no listado = sin restricción', () => {
    expect(isProviderCompatible('STRIPE', [])).toBe(true)
  })
})
