import { describe, expect, it } from 'vitest'
import {
  humanizeKycStatus,
  humanizeVenueStatus,
  inspectOwner,
  isDemoVenue,
  isOperationalVenue,
  isSuspendedVenue,
  KYC_STATUS_TONE,
  ownerFullName,
  VENUE_STATUS_TONE,
  type KycStatus,
  type VenueStatus,
} from './types'

/**
 * Catch the obvious: if alguien agrega un VenueStatus o un KycStatus nuevo
 * al backend, las funciones de aquí deberían cubrirlo. TypeScript ya nos
 * cuida el switch exhaustivo, pero estos tests fijan el contrato semántico
 * (qué color, qué texto, qué predicate) para que el cambio sea visible y
 * deliberado.
 */
describe('humanizeVenueStatus', () => {
  it.each<[VenueStatus, string]>([
    ['LIVE_DEMO', 'Demo público'],
    ['TRIAL', 'Trial'],
    ['ONBOARDING', 'En onboarding'],
    ['PENDING_ACTIVATION', 'Esperando activación'],
    ['ACTIVE', 'Activo'],
    ['SUSPENDED', 'Pausado'],
    ['ADMIN_SUSPENDED', 'Suspendido por Avoqado'],
    ['CLOSED', 'Cerrado'],
  ])('%s → %s', (status, expected) => {
    expect(humanizeVenueStatus(status)).toBe(expected)
  })
})

describe('humanizeKycStatus', () => {
  it('mapea null a "Sin KYC"', () => {
    expect(humanizeKycStatus(null)).toBe('Sin KYC')
  })

  it.each<[KycStatus, string]>([
    ['NOT_SUBMITTED', 'No enviado'],
    ['PENDING_REVIEW', 'En cola'],
    ['IN_REVIEW', 'En revisión'],
    ['VERIFIED', 'Verificado'],
    ['REJECTED', 'Rechazado'],
  ])('%s → %s', (status, expected) => {
    expect(humanizeKycStatus(status)).toBe(expected)
  })
})

describe('VENUE_STATUS_TONE', () => {
  it('asigna danger SÓLO a ADMIN_SUSPENDED — un venue suspendido por su propio dueño no es alarma roja', () => {
    expect(VENUE_STATUS_TONE.ADMIN_SUSPENDED).toBe('danger')
    expect(VENUE_STATUS_TONE.SUSPENDED).toBe('muted')
  })

  it('asigna success SÓLO a ACTIVE — los demás estados productivos no son "todo bien" todavía', () => {
    expect(VENUE_STATUS_TONE.ACTIVE).toBe('success')
    expect(VENUE_STATUS_TONE.ONBOARDING).not.toBe('success')
    expect(VENUE_STATUS_TONE.PENDING_ACTIVATION).not.toBe('success')
  })
})

describe('KYC_STATUS_TONE', () => {
  it('VERIFIED → success; REJECTED → danger; PENDING_REVIEW → warn (necesita acción)', () => {
    expect(KYC_STATUS_TONE.VERIFIED).toBe('success')
    expect(KYC_STATUS_TONE.REJECTED).toBe('danger')
    expect(KYC_STATUS_TONE.PENDING_REVIEW).toBe('warn')
  })
})

describe('predicates de estado', () => {
  it('isDemoVenue detecta LIVE_DEMO y TRIAL, nada más', () => {
    expect(isDemoVenue({ status: 'LIVE_DEMO' })).toBe(true)
    expect(isDemoVenue({ status: 'TRIAL' })).toBe(true)
    expect(isDemoVenue({ status: 'ACTIVE' })).toBe(false)
    expect(isDemoVenue({ status: 'ONBOARDING' })).toBe(false)
  })

  it('isOperationalVenue detecta ACTIVE — onboarding no cuenta como operacional', () => {
    expect(isOperationalVenue({ status: 'ACTIVE' })).toBe(true)
    expect(isOperationalVenue({ status: 'ONBOARDING' })).toBe(false)
    expect(isOperationalVenue({ status: 'PENDING_ACTIVATION' })).toBe(false)
  })

  it('isSuspendedVenue cubre ambos sabores de suspensión', () => {
    expect(isSuspendedVenue({ status: 'SUSPENDED' })).toBe(true)
    expect(isSuspendedVenue({ status: 'ADMIN_SUSPENDED' })).toBe(true)
    expect(isSuspendedVenue({ status: 'CLOSED' })).toBe(false)
    expect(isSuspendedVenue({ status: 'ACTIVE' })).toBe(false)
  })
})

describe('ownerFullName', () => {
  const baseOwner = {
    id: 'o1',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
  }

  it('concatena firstName + lastName', () => {
    expect(ownerFullName(baseOwner)).toBe('Jane Doe')
  })

  it('cae al email cuando no hay nombre', () => {
    expect(ownerFullName({ ...baseOwner, firstName: '', lastName: '' })).toBe('jane@example.com')
  })

  it('maneja sólo firstName o sólo lastName', () => {
    expect(ownerFullName({ ...baseOwner, lastName: '' })).toBe('Jane')
    expect(ownerFullName({ ...baseOwner, firstName: '' })).toBe('Doe')
  })
})

describe('inspectOwner — distinción de owners reales vs placeholders del backend', () => {
  it('reconoce el fallback "Unknown Owner" como missing', () => {
    const result = inspectOwner({
      id: '',
      firstName: 'Unknown',
      lastName: 'Owner',
      email: 'unknown@email.com',
    })
    expect(result).toEqual({ kind: 'missing', reason: 'unknown' })
  })

  it('reconoce emails sintéticos @internal.avoqado.io como missing', () => {
    const result = inspectOwner({
      id: 'staff-xx',
      firstName: 'IQ',
      lastName: 'IQ',
      email: 'tpv-iq-1778001255931-gxishc@internal.avoqado.io',
    })
    expect(result).toEqual({ kind: 'missing', reason: 'synthetic-email' })
  })

  it('clasifica como real un owner con email humano', () => {
    const result = inspectOwner({
      id: 'staff-1',
      firstName: 'Daniel',
      lastName: 'Samperino',
      email: 'daniel.samperino@playtelecom.com',
    })
    expect(result).toEqual({
      kind: 'real',
      name: 'Daniel Samperino',
      email: 'daniel.samperino@playtelecom.com',
    })
  })

  it('no se confunde con un email que solo CONTIENE internal.avoqado.io', () => {
    // Edge case: si alguien crea un email externo con esa cadena en local-part.
    const result = inspectOwner({
      id: 'staff-2',
      firstName: 'Eve',
      lastName: 'Polastri',
      email: 'eve@internal.avoqado.io.example.com',
    })
    // endsWith('@internal.avoqado.io') es false → real.
    expect(result.kind).toBe('real')
  })
})
