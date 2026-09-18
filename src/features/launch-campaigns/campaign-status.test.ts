import { describe, expect, it } from 'vitest'
import { estadoDeLaCampana, reservasEstancadas } from './campaign-status'
import type { LaunchCampaignRow } from './types'

const AHORA = new Date('2026-10-01T12:00:00.000Z')

function ficha(parche: Partial<LaunchCampaignRow> = {}): LaunchCampaignRow {
  return {
    id: 'c1',
    code: 'POS22',
    name: 'Punto de venta a $22',
    landingSlug: 'pos-22',
    vertical: 'ALL',
    channel: 'GOOGLE_ADS',
    planTier: 'PRO',
    billingInterval: 'MONTHLY',
    advertisedPriceCents: 2200,
    discountMonths: 3,
    currency: 'MXN',
    offerVersion: 1,
    listPriceCentsSnapshot: 115884,
    discountAmountCents: 113684,
    stripePriceId: 'price_1',
    stripeCouponId: 'LC_POS22_V1',
    validFrom: '2026-09-20T06:00:00.000Z',
    validUntil: '2026-11-01T06:00:00.000Z',
    redemptionCap: 100,
    redemptionCount: 12,
    headline: null,
    subheadline: null,
    bullets: [],
    status: 'ACTIVE',
    statusReason: null,
    activatedAt: '2026-09-20T06:00:00.000Z',
    createdById: 's1',
    updatedById: 's1',
    createdAt: '2026-09-18T06:00:00.000Z',
    updatedAt: '2026-09-20T06:00:00.000Z',
    ...parche,
  }
}

/**
 * 🔴 El orden de los motivos es el MISMO que el de `launchOfferAvailability` del
 * servidor. No es cosmético: si esta pantalla dijera "Vencida" donde el endpoint
 * público contesta "PAUSED", el operador tomaría una decisión sobre un estado que
 * el cliente no está viendo.
 */
describe('estadoDeLaCampana', () => {
  it('una campaña vigente con cupo se lee "Activa"', () => {
    const e = estadoDeLaCampana(ficha(), AHORA)
    expect(e.label).toBe('Activa')
    expect(e.tone).toBe('success')
    expect(e.vendiendo).toBe(true)
  })

  it('un borrador no se está ofreciendo, y lo dice', () => {
    const e = estadoDeLaCampana(ficha({ status: 'DRAFT', activatedAt: null }), AHORA)
    expect(e.label).toBe('Borrador')
    expect(e.vendiendo).toBe(false)
    expect(e.explicacion).toMatch(/no se ofrece/i)
  })

  it('pausada y terminada se distinguen', () => {
    expect(estadoDeLaCampana(ficha({ status: 'PAUSED' }), AHORA).label).toBe('Pausada')
    expect(estadoDeLaCampana(ficha({ status: 'ENDED' }), AHORA).label).toBe('Terminada')
  })

  it('antes de su vigencia está "Programada", no activa', () => {
    const e = estadoDeLaCampana(ficha({ validFrom: '2026-12-01T06:00:00.000Z' }), AHORA)
    expect(e.label).toBe('Programada')
    expect(e.vendiendo).toBe(false)
  })

  it('pasada la vigencia está "Vencida"', () => {
    const e = estadoDeLaCampana(ficha({ validUntil: '2026-09-30T06:00:00.000Z' }), AHORA)
    expect(e.label).toBe('Vencida')
    expect(e.vendiendo).toBe(false)
  })

  /** El instante exacto del fin ya NO vende: la condición es `now < validUntil`. */
  it('el instante del fin ya no vende', () => {
    const e = estadoDeLaCampana(ficha({ validUntil: AHORA.toISOString() }), AHORA)
    expect(e.label).toBe('Vencida')
  })

  it('sin cupo libre está "Llena", y dice cuántos', () => {
    const e = estadoDeLaCampana(ficha({ redemptionCount: 100, redemptionCap: 100 }), AHORA)
    expect(e.label).toBe('Llena')
    expect(e.vendiendo).toBe(false)
    expect(e.explicacion).toMatch(/100/)
  })

  /**
   * ACTIVE sin cupón es un estado imposible por contrato, pero si llegara, la
   * landing contestaría NOT_PUBLISHED: se avisa en vez de pintar "Activa".
   */
  it('activa sin cupón congelado se marca como sin publicar', () => {
    const e = estadoDeLaCampana(
      ficha({ stripeCouponId: null, listPriceCentsSnapshot: null }),
      AHORA,
    )
    expect(e.label).toBe('Sin publicar')
    expect(e.vendiendo).toBe(false)
  })

  it('pausada gana sobre vencida, igual que en el servidor', () => {
    const e = estadoDeLaCampana(
      ficha({ status: 'PAUSED', validUntil: '2026-09-30T06:00:00.000Z' }),
      AHORA,
    )
    expect(e.label).toBe('Pausada')
  })

  it('terminada gana sobre llena', () => {
    const e = estadoDeLaCampana(
      ficha({ status: 'ENDED', redemptionCount: 100, redemptionCap: 100 }),
      AHORA,
    )
    expect(e.label).toBe('Terminada')
  })
})

/**
 * 🔴 Esta cuenta es lo ÚNICO que hace visible el riesgo R2: un lugar apartado que
 * nadie reintenta consume cupo para siempre, porque el barrido que los liberaría
 * no existe en fase 1. Sin este número, una campaña se queda "llena" de lugares
 * fantasma y desde afuera se ve idéntica a una que de verdad se agotó.
 */
describe('reservasEstancadas', () => {
  const ahora = new Date('2026-10-01T12:00:00.000Z')
  const fila = (reservedAt: string) => ({ reservedAt })

  it('cuenta las apartadas hace más de 30 minutos', () => {
    const filas = [
      fila('2026-10-01T11:00:00.000Z'), // 60 min
      fila('2026-10-01T11:25:00.000Z'), // 35 min
      fila('2026-10-01T11:45:00.000Z'), // 15 min — todavía en curso
    ]
    expect(reservasEstancadas(filas, ahora)).toBe(2)
  })

  it('el límite exacto todavía no cuenta: son "más de" 30 minutos', () => {
    expect(reservasEstancadas([fila('2026-10-01T11:30:00.000Z')], ahora)).toBe(0)
    expect(reservasEstancadas([fila('2026-10-01T11:29:59.000Z')], ahora)).toBe(1)
  })

  it('sin filas no hay alerta', () => {
    expect(reservasEstancadas([], ahora)).toBe(0)
    expect(reservasEstancadas(undefined, ahora)).toBe(0)
  })

  it('una fecha ilegible no se cuenta como estancada', () => {
    expect(reservasEstancadas([fila('no es fecha')], ahora)).toBe(0)
  })
})
