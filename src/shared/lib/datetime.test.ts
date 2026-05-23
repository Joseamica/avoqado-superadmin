import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIMEZONE,
  formatDate,
  formatDateISO,
  formatDateTime,
  formatTime,
  formatRelative,
  timezoneShort,
} from './datetime'

// formatTime usa TIME_24_SIMPLE (hour12: false) → locale-independent.
// formatDateISO devuelve YYYY-MM-DD → también locale-independent.
// Por eso los assertions más robustos van por esos dos helpers.

describe('datetime helpers', () => {
  it('returns "—" for null / undefined / empty strings', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatTime('')).toBe('—')
    expect(formatDateISO(null)).toBe('—')
    expect(formatRelative(null)).toBe('—')
  })

  it('returns "—" for unparseable input', () => {
    expect(formatDateTime('not-a-date')).toBe('—')
    expect(formatDateISO('garbage')).toBe('—')
  })

  it('formatDateISO returns the same date for a UTC daytime value', () => {
    // 14:00 UTC on May 23 → still May 23 in MX (whether UTC-6 or UTC-5).
    expect(formatDateISO('2026-05-23T14:00:00.000Z')).toBe('2026-05-23')
  })

  it('formatDateISO rolls back the date when UTC is past midnight but MX is not yet', () => {
    // 02:00 UTC on May 23 → 20:00/21:00 on May 22 in Mexico_City.
    expect(formatDateISO('2026-05-23T02:00:00.000Z')).toBe('2026-05-22')
  })

  it('formatDateISO differs across timezones near UTC boundaries', () => {
    const lateUtc = '2026-05-23T22:00:00.000Z'
    expect(formatDateISO(lateUtc, 'America/Mexico_City')).toBe('2026-05-23')
    expect(formatDateISO(lateUtc, 'Asia/Tokyo')).toBe('2026-05-24')
  })

  it('formatTime renders in 24h (locale-independent) and shifts with timezone', () => {
    // Tokyo is UTC+9 año redondo; UTC es UTC. 20:30Z → 05:30 Tokyo (siguiente día), 20:30 UTC.
    expect(formatTime('2026-05-23T20:30:00.000Z', 'UTC')).toBe('20:30')
    expect(formatTime('2026-05-23T20:30:00.000Z', 'Asia/Tokyo')).toBe('05:30')
  })

  it('timezoneShort returns a non-empty abbreviation for the default TZ', () => {
    const short = timezoneShort(DEFAULT_TIMEZONE)
    expect(typeof short).toBe('string')
    expect(short.length).toBeGreaterThan(0)
  })

  it('formatRelative returns a string for a recent moment', () => {
    const result = formatRelative(new Date(Date.now() - 5 * 60_000).toISOString())
    expect(typeof result).toBe('string')
    expect(result).not.toBe('—')
  })
})
