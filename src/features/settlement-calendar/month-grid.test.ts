import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildMonthGrid,
  currentMonth,
  daysInMonth,
  formatDayLabel,
  formatMonthLabel,
  shiftMonth,
  todayKey,
} from './month-grid'

describe('daysInMonth', () => {
  it('handles 31/30/28-day months and leap years', () => {
    expect(daysInMonth('2026-07')).toBe(31)
    expect(daysInMonth('2026-06')).toBe(30)
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2024-02')).toBe(29)
  })
})

describe('buildMonthGrid', () => {
  it('starts weeks on Monday and pads both ends to full weeks', () => {
    // 2026-07-01 cae miércoles → 2 días de relleno (lun 29 y mar 30 de junio).
    const weeks = buildMonthGrid('2026-07')
    expect(weeks[0].map((c) => c.date)).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
    ])
    expect(weeks[0][0].inMonth).toBe(false)
    expect(weeks[0][2].inMonth).toBe(true)
    weeks.forEach((w) => expect(w).toHaveLength(7))
  })

  it('includes every day of the month exactly once', () => {
    for (const month of ['2026-07', '2026-02', '2024-02', '2026-11']) {
      const inMonth = buildMonthGrid(month)
        .flat()
        .filter((c) => c.inMonth)
      expect(inMonth).toHaveLength(daysInMonth(month))
      expect(new Set(inMonth.map((c) => c.date)).size).toBe(daysInMonth(month))
    }
  })

  it('handles a month starting exactly on Monday (no leading padding)', () => {
    // 2026-06-01 es lunes.
    const weeks = buildMonthGrid('2026-06')
    expect(weeks[0][0]).toEqual({ date: '2026-06-01', inMonth: true })
  })

  it('crosses a year boundary without breaking', () => {
    const weeks = buildMonthGrid('2026-01')
    const dates = weeks.flat().map((c) => c.date)
    expect(dates).toContain('2025-12-29') // relleno del año anterior
    expect(dates).toContain('2026-01-31')
  })

  // El bug que esto previene: usar `new Date('2026-07-01')` resuelve a medianoche
  // del TZ del browser, así que en un browser al este de UTC el grid se recorre un
  // día entero y las llaves dejan de casar con las que manda el backend.
  it('produces identical grids regardless of the browser timezone', () => {
    const reference = JSON.stringify(buildMonthGrid('2026-07'))
    for (const tz of ['UTC', 'Pacific/Kiritimati', 'Pacific/Midway', 'Asia/Tokyo']) {
      vi.stubEnv('TZ', tz)
      expect(JSON.stringify(buildMonthGrid('2026-07'))).toBe(reference)
    }
  })
})

describe('shiftMonth', () => {
  it('moves forward and backward across year boundaries', () => {
    expect(shiftMonth('2026-07', 1)).toBe('2026-08')
    expect(shiftMonth('2026-07', -1)).toBe('2026-06')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})

describe('formatting', () => {
  it('renders Spanish month and day labels', () => {
    expect(formatMonthLabel('2026-07')).toBe('julio 2026')
    expect(formatMonthLabel('2026-01')).toBe('enero 2026')
    expect(formatDayLabel('2026-07-15')).toBe('15 de julio')
    expect(formatDayLabel('2026-12-01')).toBe('1 de diciembre')
  })
})

describe('todayKey / currentMonth', () => {
  afterEach(() => vi.useRealTimers())

  it('resolves "today" in the venue timezone, not UTC', () => {
    // 2026-07-15 02:00 UTC = 2026-07-14 20:00 en México → el día local sigue siendo el 14.
    vi.useFakeTimers().setSystemTime(new Date('2026-07-15T02:00:00Z'))
    expect(todayKey('America/Mexico_City')).toBe('2026-07-14')
    expect(todayKey('UTC')).toBe('2026-07-15')
    expect(currentMonth('America/Mexico_City')).toBe('2026-07')
  })
})
