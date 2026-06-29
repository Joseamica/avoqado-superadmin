import { describe, it, expect } from 'vitest'
import {
  humanizeCfdiStatus,
  humanizeCsdStatus,
  humanizeCustomerKind,
  paymentState,
  CFDI_STATUS_TONE,
  CSD_STATUS_TONE,
  PAYMENT_STATE_TONE,
  PAYMENT_STATE_LABEL,
  type PlatformCfdi,
} from './types'

function makeCfdi(overrides: Partial<PlatformCfdi> = {}): PlatformCfdi {
  return {
    id: 'c1',
    platformEmisorId: 'e1',
    billingTaxProfileId: 'tp1',
    type: 'INGRESO',
    parentPlatformCfdiId: null,
    organizationId: null,
    venueId: null,
    receptorRfc: 'XAXX010101000',
    receptorNombre: 'Cliente Demo',
    receptorRegimen: '601',
    receptorCp: '06000',
    usoCfdi: 'G03',
    lines: null,
    formaPago: '99',
    metodoPago: 'PPD',
    subtotalCents: 100000,
    discountCents: 0,
    taxCents: 16000,
    totalCents: 116000,
    currency: 'MXN',
    amountPaidCents: 0,
    paymentInfo: null,
    status: 'STAMPED',
    facturapiId: null,
    uuid: null,
    serie: null,
    folio: null,
    stampedAt: null,
    cancelMotivo: null,
    cancelStatus: null,
    cancelledAt: null,
    emailSentAt: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('humanizeCfdiStatus', () => {
  it('traduce cada status conocido al español', () => {
    expect(humanizeCfdiStatus('DRAFT')).toBe('Borrador')
    expect(humanizeCfdiStatus('STAMPING')).toBe('Timbrando')
    expect(humanizeCfdiStatus('STAMPED')).toBe('Timbrada')
    expect(humanizeCfdiStatus('STAMP_FAILED')).toBe('Error al timbrar')
    expect(humanizeCfdiStatus('CANCEL_REQUESTED')).toBe('Cancelación pedida')
    expect(humanizeCfdiStatus('CANCELLED')).toBe('Cancelada')
  })

  it('cae al raw status cuando no está en el mapa', () => {
    expect(humanizeCfdiStatus('UNKNOWN' as never)).toBe('UNKNOWN')
  })

  it('define un tono para cada status', () => {
    for (const k of Object.keys(CFDI_STATUS_TONE) as Array<keyof typeof CFDI_STATUS_TONE>) {
      expect(CFDI_STATUS_TONE[k]).toBeTruthy()
    }
    expect(CFDI_STATUS_TONE.STAMPED).toBe('success')
    expect(CFDI_STATUS_TONE.STAMP_FAILED).toBe('danger')
  })
})

describe('humanizeCsdStatus', () => {
  it('traduce cada estado del CSD', () => {
    expect(humanizeCsdStatus('NONE')).toBe('Sin CSD')
    expect(humanizeCsdStatus('UPLOADED')).toBe('CSD cargado')
    expect(humanizeCsdStatus('ACTIVE')).toBe('CSD activo')
    expect(humanizeCsdStatus('EXPIRED')).toBe('CSD expirado')
    expect(humanizeCsdStatus('RESTRICTED')).toBe('CSD restringido')
  })

  it('cae al raw value desconocido', () => {
    expect(humanizeCsdStatus('XYZ' as never)).toBe('XYZ')
  })

  it('mapea tonos semánticos', () => {
    expect(CSD_STATUS_TONE.ACTIVE).toBe('success')
    expect(CSD_STATUS_TONE.EXPIRED).toBe('danger')
  })
})

describe('humanizeCustomerKind', () => {
  it('traduce los tres tipos de cliente', () => {
    expect(humanizeCustomerKind('ORGANIZATION')).toBe('Organización')
    expect(humanizeCustomerKind('VENUE')).toBe('Venue')
    expect(humanizeCustomerKind('STANDALONE')).toBe('Externo')
  })

  it('cae al raw kind desconocido', () => {
    expect(humanizeCustomerKind('OTRO' as never)).toBe('OTRO')
  })
})

describe('paymentState', () => {
  it('NA cuando el CFDI no es de tipo INGRESO', () => {
    expect(paymentState(makeCfdi({ type: 'PAGO', metodoPago: 'PPD' }))).toBe('NA')
  })

  it('NA cuando el método de pago es PUE', () => {
    expect(paymentState(makeCfdi({ type: 'INGRESO', metodoPago: 'PUE' }))).toBe('NA')
  })

  it('PENDING para un PPD sin abonos', () => {
    expect(paymentState(makeCfdi({ amountPaidCents: 0, totalCents: 116000 }))).toBe('PENDING')
  })

  it('PARTIAL cuando hay un abono parcial', () => {
    expect(paymentState(makeCfdi({ amountPaidCents: 50000, totalCents: 116000 }))).toBe('PARTIAL')
  })

  it('PAID cuando los abonos cubren (o exceden) el total', () => {
    expect(paymentState(makeCfdi({ amountPaidCents: 116000, totalCents: 116000 }))).toBe('PAID')
    expect(paymentState(makeCfdi({ amountPaidCents: 200000, totalCents: 116000 }))).toBe('PAID')
  })

  it('cada PaymentState tiene tono y label', () => {
    for (const s of ['NA', 'PENDING', 'PARTIAL', 'PAID'] as const) {
      expect(PAYMENT_STATE_TONE[s]).toBeTruthy()
      expect(PAYMENT_STATE_LABEL[s]).toBeTruthy()
    }
  })
})
