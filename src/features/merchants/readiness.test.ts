import { describe, it, expect } from 'vitest'
import { computeReadiness } from './readiness'
import type { MerchantAccount } from './types'

const base: MerchantAccount = {
  id: 'm1',
  provider: { id: 'p1', code: 'BLUMON', name: 'Blumon', type: 'PAYMENT_PROCESSOR' },
  externalMerchantId: '9814275',
  alias: null,
  displayName: 'Cuenta Principal',
  active: true,
  displayOrder: 0,
  clabeNumber: null,
  bankName: null,
  accountHolder: null,
  hasCredentials: true,
  blumonSerialNumber: '2841548417',
  blumonPosId: '376',
  blumonEnvironment: 'SANDBOX',
  blumonMerchantId: null,
  angelpayAffiliation: null,
  angelpayMerchantName: null,
  aggregatorId: null,
  venues: [{ id: 'v1', name: 'Doña Simona', slug: 'dona-simona' }],
  terminals: [{ id: 't1', serialNumber: 'AVQD-2841548417' }],
  counts: { costStructures: 1, venueConfigs: 1, terminals: 1 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('computeReadiness', () => {
  it('marca ok credenciales/costo/slots/terminales cuando hay datos', () => {
    const r = computeReadiness(base, { hasSettlement: true })
    const by = Object.fromEntries(r.map((c) => [c.key, c.state]))
    expect(by.credentials).toBe('ok')
    expect(by.cost).toBe('ok')
    expect(by.slots).toBe('ok')
    expect(by.terminals).toBe('ok')
    expect(by.settlement).toBe('ok')
  })

  it('marca missing lo que falta', () => {
    const m = {
      ...base,
      hasCredentials: false,
      counts: { costStructures: 0, venueConfigs: 0, terminals: 0 },
    }
    const r = computeReadiness(m, { hasSettlement: false })
    const by = Object.fromEntries(r.map((c) => [c.key, c.state]))
    expect(by.credentials).toBe('missing')
    expect(by.cost).toBe('missing')
    expect(by.slots).toBe('missing')
    expect(by.terminals).toBe('missing')
    expect(by.settlement).toBe('missing')
  })
})
