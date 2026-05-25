import { describe, it, expect } from 'vitest'
import {
  actorDisplayName,
  categorizeEntry,
  humanizeAction,
  humanizeEntity,
  severityFor,
} from './types'

describe('actorDisplayName', () => {
  it('returns "Sistema" when staff is null', () => {
    expect(actorDisplayName(null)).toBe('Sistema')
  })

  it('concatenates first + last when both present', () => {
    expect(actorDisplayName({ id: 's1', firstName: 'Ada', lastName: 'Lovelace' })).toBe(
      'Ada Lovelace',
    )
  })

  it('falls back to just one name when the other is null', () => {
    expect(actorDisplayName({ id: 's1', firstName: 'Ada', lastName: null })).toBe('Ada')
    expect(actorDisplayName({ id: 's1', firstName: null, lastName: 'Lovelace' })).toBe('Lovelace')
  })

  it('returns "Staff sin nombre" when both names are null', () => {
    expect(actorDisplayName({ id: 's1', firstName: null, lastName: null })).toBe('Staff sin nombre')
  })
})

describe('categorizeEntry', () => {
  it.each([
    ['PERMISSION_DENIED', null, 'auth'],
    ['LOGIN', null, 'config'], // LOGIN doesn't match the regex; falls through
    ['KYC_APPROVED', null, 'kyc'],
    ['TERMINAL_CREATED', 'Terminal', 'terminal'],
    ['APP_UPDATE_PUBLISHED', null, 'terminal'],
    ['PAYMENT_COMPLETED', 'Payment', 'payment'],
    ['ORDER_CREATED', 'Order', 'payment'],
    ['VENUE_CREATED', 'Venue', 'venue'],
    ['SETTINGS_UPDATED', null, 'config'],
  ])('categorizes %s/%s as %s', (action, entity, expected) => {
    expect(categorizeEntry({ action, entity })).toBe(expected)
  })
})

describe('severityFor', () => {
  it('returns "danger" for DENIED / FAIL / ERROR / REJECT', () => {
    expect(severityFor('PERMISSION_DENIED')).toBe('danger')
    expect(severityFor('LOGIN_FAILED')).toBe('danger')
    expect(severityFor('PAYMENT_REJECTED')).toBe('danger')
  })

  it('returns "warn" for DISABLED / MODIFIED / UPDATE / CHANGE', () => {
    expect(severityFor('FEATURE_DISABLED_BY_ADMIN')).toBe('warn')
    expect(severityFor('VENUE_UPDATED')).toBe('warn')
    expect(severityFor('STAFF_ROLE_CHANGED')).toBe('warn')
  })

  it('returns "success" for CREATE / ACTIVATE / APPROVED / ENABLED', () => {
    expect(severityFor('VENUE_CREATED')).toBe('success')
    expect(severityFor('VENUE_REACTIVATED')).toBe('success')
    expect(severityFor('KYC_APPROVED')).toBe('success')
    expect(severityFor('PERMISSION_GRANTED')).toBe('success')
  })

  it('falls back to "info" when nothing matches', () => {
    expect(severityFor('SOMETHING_UNCATEGORIZED')).toBe('info')
  })
})

describe('humanizeAction', () => {
  it('returns Spanish labels for known actions', () => {
    expect(humanizeAction('LOGIN')).toBe('Inicio de sesión')
    expect(humanizeAction('VENUE_CREATED')).toBe('Venue creado')
  })

  it('falls back to a sentence-cased version for unknown actions', () => {
    expect(humanizeAction('SOME_UNKNOWN_ACTION')).toBe('Some unknown action')
  })
})

describe('humanizeEntity', () => {
  it('returns Spanish labels for known entities', () => {
    expect(humanizeEntity('Venue')).toBe('Venue')
    expect(humanizeEntity('Staff')).toBe('Personal')
    expect(humanizeEntity('PaymentLink')).toBe('Liga de pago')
  })

  it('passes through unknown entities verbatim', () => {
    expect(humanizeEntity('CustomEntity')).toBe('CustomEntity')
  })

  it('returns empty string for null/undefined', () => {
    expect(humanizeEntity(null)).toBe('')
    expect(humanizeEntity(undefined)).toBe('')
  })
})
