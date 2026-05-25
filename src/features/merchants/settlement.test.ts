import { describe, it, expect } from 'vitest'
import { projectSettlementDate } from './settlement'

// 2026-05-22 es viernes (UTC).
const friday = new Date(Date.UTC(2026, 4, 22))
const iso = (d: Date) => d.toISOString().slice(0, 10)

describe('projectSettlementDate', () => {
  it('días=0 → mismo día', () => {
    expect(iso(projectSettlementDate(friday, 0, 'BUSINESS_DAYS', new Set()))).toBe('2026-05-22')
  })
  it('D+1 hábil salta el fin de semana (vie → lun)', () => {
    expect(iso(projectSettlementDate(friday, 1, 'BUSINESS_DAYS', new Set()))).toBe('2026-05-25')
  })
  it('D+3 hábil (vie → mié)', () => {
    expect(iso(projectSettlementDate(friday, 3, 'BUSINESS_DAYS', new Set()))).toBe('2026-05-27')
  })
  it('salta un feriado intermedio', () => {
    expect(iso(projectSettlementDate(friday, 1, 'BUSINESS_DAYS', new Set(['2026-05-25'])))).toBe(
      '2026-05-26',
    )
  })
  it('CALENDAR_DAYS suma días naturales', () => {
    expect(iso(projectSettlementDate(friday, 3, 'CALENDAR_DAYS', new Set()))).toBe('2026-05-25')
  })
})
