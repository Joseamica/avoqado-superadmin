import { describe, expect, it } from 'vitest'
import {
  campoBloqueado,
  couponIdFor,
  desgloseEsExacto,
  problemasDeLaCampana,
  puedeGuardar,
  type BorradorCampana,
} from './offer-rules'

const BORRADOR: BorradorCampana = {
  code: 'POS22',
  name: 'Punto de venta a $22',
  landingSlug: 'pos-22',
  vertical: 'ALL',
  channel: 'GOOGLE_ADS',
  planTier: 'PRO',
  advertisedPrice: '22',
  discountMonths: '3',
  redemptionCap: '100',
  validFrom: '2026-09-20T00:00',
  validUntil: '2026-10-31T00:00',
  headline: 'Tu punto de venta a $22 al mes',
  subheadline: '',
  bullets: [],
  featuredForVertical: false,
}

/** El precio de lista de PRO mensual con IVA, que es lo que devuelve la vista previa. */
const LISTA = 115884

describe('problemasDeLaCampana — la oferta tiene que cuadrar antes de guardarla', () => {
  it('un borrador coherente no reporta nada', () => {
    expect(problemasDeLaCampana(BORRADOR, { listPriceCents: LISTA })).toEqual({})
    expect(puedeGuardar(BORRADOR, { listPriceCents: LISTA })).toBe(true)
  })

  /**
   * 🔴 El corazón de la pantalla: el precio anunciado, el plan y el descuento
   * tienen que poder convertirse en un cupón. `amount_off = lista − anunciado`,
   * así que un anunciado igual o mayor que la lista no es un descuento y el
   * servidor lo rechaza con `PLAN_PRICE_UNAVAILABLE`. Se ve ANTES de guardar.
   */
  it('el precio anunciado tiene que ser MENOR que el de lista del plan', () => {
    const e = problemasDeLaCampana(
      { ...BORRADOR, advertisedPrice: '1158.84' },
      { listPriceCents: LISTA },
    )
    expect(e.advertisedPrice).toMatch(/menor/i)
    expect(
      puedeGuardar({ ...BORRADOR, advertisedPrice: '1158.84' }, { listPriceCents: LISTA }),
    ).toBe(false)

    const mayor = problemasDeLaCampana(
      { ...BORRADOR, advertisedPrice: '2000' },
      { listPriceCents: LISTA },
    )
    expect(mayor.advertisedPrice).toMatch(/menor/i)
  })

  it('un centavo por debajo de la lista sí cuadra', () => {
    const e = problemasDeLaCampana(
      { ...BORRADOR, advertisedPrice: '1158.83' },
      { listPriceCents: LISTA },
    )
    expect(e.advertisedPrice).toBeUndefined()
  })

  /**
   * Stripe no cobra menos de $10.00 MXN. Sin este tope, la campaña se guarda,
   * se activa, y el primer cliente que intenta pagar recibe un error del banco.
   */
  it('el precio anunciado no baja de $10.00', () => {
    expect(
      problemasDeLaCampana({ ...BORRADOR, advertisedPrice: '9.99' }, { listPriceCents: LISTA })
        .advertisedPrice,
    ).toMatch(/\$10\.00/)
    expect(
      problemasDeLaCampana({ ...BORRADOR, advertisedPrice: '10' }, { listPriceCents: LISTA })
        .advertisedPrice,
    ).toBeUndefined()
  })

  it('un precio que no es un número se dice, no se adivina', () => {
    expect(
      problemasDeLaCampana({ ...BORRADOR, advertisedPrice: 'veintidós' }, { listPriceCents: LISTA })
        .advertisedPrice,
    ).toBeTruthy()
    expect(
      problemasDeLaCampana({ ...BORRADOR, advertisedPrice: '' }, { listPriceCents: LISTA })
        .advertisedPrice,
    ).toBeTruthy()
  })

  /**
   * Mientras la vista previa no contesta no se sabe el precio de lista. Inventar
   * el veredicto en un sentido bloquearía una campaña buena; en el otro dejaría
   * pasar una imposible. Se calla el que depende de la lista y se conserva el resto.
   */
  it('sin el precio de lista no inventa el veredicto de "menor que la lista"', () => {
    expect(
      problemasDeLaCampana({ ...BORRADOR, advertisedPrice: '99999' }, {}).advertisedPrice,
    ).toBeUndefined()
    expect(problemasDeLaCampana({ ...BORRADOR, advertisedPrice: '5' }, {}).advertisedPrice).toMatch(
      /\$10\.00/,
    )
  })

  it('los meses de descuento van de 1 a 24', () => {
    expect(
      problemasDeLaCampana({ ...BORRADOR, discountMonths: '0' }, { listPriceCents: LISTA })
        .discountMonths,
    ).toBeTruthy()
    expect(
      problemasDeLaCampana({ ...BORRADOR, discountMonths: '25' }, { listPriceCents: LISTA })
        .discountMonths,
    ).toBeTruthy()
    expect(
      problemasDeLaCampana({ ...BORRADOR, discountMonths: '2.5' }, { listPriceCents: LISTA })
        .discountMonths,
    ).toBeTruthy()
    expect(
      problemasDeLaCampana({ ...BORRADOR, discountMonths: '24' }, { listPriceCents: LISTA })
        .discountMonths,
    ).toBeUndefined()
  })

  it('el cupo es obligatorio y mayor que cero', () => {
    expect(
      problemasDeLaCampana({ ...BORRADOR, redemptionCap: '0' }, { listPriceCents: LISTA })
        .redemptionCap,
    ).toBeTruthy()
    expect(
      problemasDeLaCampana({ ...BORRADOR, redemptionCap: '' }, { listPriceCents: LISTA })
        .redemptionCap,
    ).toBeTruthy()
  })

  /**
   * 🔴 Bajar el cupo por debajo de lo ya redimido le da un 400 del servidor
   * (`CAP_BELOW_COUNT`). Aquí sólo se avisa antes: el veredicto que manda sigue
   * siendo el `UPDATE` condicional del servidor, porque entre esta pantalla y la
   * escritura cabe una reserva nueva.
   */
  it('avisa si el cupo queda por debajo de los lugares ya tomados', () => {
    const e = problemasDeLaCampana(
      { ...BORRADOR, redemptionCap: '5' },
      { listPriceCents: LISTA, redemptionCount: 12 },
    )
    expect(e.redemptionCap).toMatch(/12/)
    expect(
      problemasDeLaCampana(
        { ...BORRADOR, redemptionCap: '12' },
        { listPriceCents: LISTA, redemptionCount: 12 },
      ).redemptionCap,
    ).toBeUndefined()
  })

  it('la vigencia tiene que terminar después de empezar', () => {
    const e = problemasDeLaCampana(
      { ...BORRADOR, validUntil: '2026-09-20T00:00' },
      { listPriceCents: LISTA },
    )
    expect(e.validUntil).toBeTruthy()
    expect(
      problemasDeLaCampana({ ...BORRADOR, validFrom: '' }, { listPriceCents: LISTA }).validFrom,
    ).toBeTruthy()
  })

  it('el código y el slug respetan la forma que el servidor exige', () => {
    expect(
      problemasDeLaCampana({ ...BORRADOR, code: 'po' }, { listPriceCents: LISTA }).code,
    ).toBeTruthy()
    expect(
      problemasDeLaCampana({ ...BORRADOR, code: 'pos 22' }, { listPriceCents: LISTA }).code,
    ).toBeTruthy()
    expect(
      problemasDeLaCampana({ ...BORRADOR, landingSlug: 'pos--22' }, { listPriceCents: LISTA })
        .landingSlug,
    ).toBeTruthy()
    expect(
      problemasDeLaCampana({ ...BORRADOR, landingSlug: 'pos 22' }, { listPriceCents: LISTA })
        .landingSlug,
    ).toBeTruthy()
    expect(
      problemasDeLaCampana({ ...BORRADOR, name: 'ab' }, { listPriceCents: LISTA }).name,
    ).toBeTruthy()
  })

  /**
   * Mayúsculas y minúsculas NO son un error: el Zod del servidor hace
   * `.trim().toLowerCase()` (y `.toUpperCase()` en el código) ANTES de aplicar la
   * expresión regular, así que `POS-22` es un slug legal que se guarda como
   * `pos-22`. Rechazarlo aquí sería la pantalla siendo más estricta que el
   * contrato — el editor normaliza a la vista en vez de acusar.
   */
  it('el servidor normaliza mayúsculas: no son un error', () => {
    expect(
      problemasDeLaCampana({ ...BORRADOR, landingSlug: 'POS-22' }, { listPriceCents: LISTA })
        .landingSlug,
    ).toBeUndefined()
    expect(
      problemasDeLaCampana({ ...BORRADOR, code: 'pos22' }, { listPriceCents: LISTA }).code,
    ).toBeUndefined()
  })

  it('los textos respetan sus topes', () => {
    expect(
      problemasDeLaCampana({ ...BORRADOR, headline: 'x'.repeat(121) }, { listPriceCents: LISTA })
        .headline,
    ).toBeTruthy()
    expect(
      problemasDeLaCampana({ ...BORRADOR, subheadline: 'x'.repeat(201) }, { listPriceCents: LISTA })
        .subheadline,
    ).toBeTruthy()
    expect(
      problemasDeLaCampana(
        { ...BORRADOR, bullets: Array(7).fill('uno') },
        { listPriceCents: LISTA },
      ).bullets,
    ).toBeTruthy()
    expect(
      problemasDeLaCampana({ ...BORRADOR, bullets: ['x'.repeat(121)] }, { listPriceCents: LISTA })
        .bullets,
    ).toBeTruthy()
  })
})

describe('campoBloqueado — la tabla de edición por estado', () => {
  const draft = { status: 'DRAFT' as const, activatedAt: null, redemptionCount: 0 }
  const activa = {
    status: 'ACTIVE' as const,
    activatedAt: '2026-09-20T06:00:00.000Z',
    redemptionCount: 0,
  }
  const conLugares = { ...activa, redemptionCount: 3 }
  const terminada = {
    status: 'ENDED' as const,
    activatedAt: '2026-09-20T06:00:00.000Z',
    redemptionCount: 3,
  }

  it('el código es inmutable siempre, incluso en borrador', () => {
    expect(campoBloqueado('code', draft)).toBeTruthy()
    expect(campoBloqueado('code', activa)).toBeTruthy()
  })

  it('la oferta sólo se toca en borrador', () => {
    for (const campo of ['planTier', 'advertisedPrice', 'discountMonths'] as const) {
      expect(campoBloqueado(campo, draft)).toBeNull()
      expect(campoBloqueado(campo, activa)).toMatch(/termina/i)
      expect(campoBloqueado(campo, terminada)).toBeTruthy()
    }
  })

  it('el slug se congela con la primera activación', () => {
    expect(campoBloqueado('landingSlug', draft)).toBeNull()
    expect(campoBloqueado('landingSlug', activa)).toBeTruthy()
  })

  it('nombre, vertical, canal y textos siguen editables con la campaña activa', () => {
    for (const campo of [
      'name',
      'vertical',
      'channel',
      'headline',
      'subheadline',
      'bullets',
    ] as const) {
      expect(campoBloqueado(campo, activa)).toBeNull()
      expect(campoBloqueado(campo, terminada)).toBeTruthy()
    }
  })

  it('el inicio de la vigencia se congela en cuanto alguien tomó un lugar', () => {
    expect(campoBloqueado('validFrom', activa)).toBeNull()
    expect(campoBloqueado('validFrom', conLugares)).toMatch(/lugar/i)
    expect(campoBloqueado('validUntil', conLugares)).toBeNull()
  })

  it('una campaña terminada no se edita en nada', () => {
    for (const campo of ['name', 'validUntil', 'redemptionCap', 'headline'] as const) {
      expect(campoBloqueado(campo, terminada)).toBeTruthy()
    }
  })
})

describe('couponIdFor', () => {
  it('arma el id versionado con el que el servidor crea el cupón', () => {
    expect(couponIdFor('POS22', 1)).toBe('LC_POS22_V1')
    expect(couponIdFor('retail_sep26', 2)).toBe('LC_RETAIL_SEP26_V2')
  })
})

/**
 * 🔴 El desglose del IVA se pinta SÓLO si cuadra, y quién decide es el pago del
 * servidor, nunca un precio escrito a mano aquí.
 *
 * Un total con IVA incluido no siempre admite una base de dos decimales que lo
 * reproduzca: $22.00 sale de una base de $18.97, y $18.97 × 1.16 = $22.01. La
 * suma que se muestra cuadra por construcción (IVA = total − base), pero la
 * MULTIPLICACIÓN no, y eso es lo que un contador revisa en el CFDI. Cuando no
 * cuadra, se enseña el total y se calla el desglose en vez de imprimir una
 * cuenta que no se sostiene.
 */
describe('desgloseEsExacto', () => {
  it('el precio de lista de PRO cuadra al centavo', () => {
    expect(desgloseEsExacto({ subtotalCents: 99900, ivaCents: 15984 })).toBe(true)
  })

  it('un total de $22.00 NO admite base exacta de dos decimales', () => {
    // 1897 + 303 = 2200, pero 1897 × 1.16 = 2200.52 → $22.01.
    expect(desgloseEsExacto({ subtotalCents: 1897, ivaCents: 303 })).toBe(false)
  })

  it('un total elegido con base exacta sí cuadra', () => {
    // $23.20 = $20.00 + $3.20.
    expect(desgloseEsExacto({ subtotalCents: 2000, ivaCents: 320 })).toBe(true)
  })

  it('sin desglose no hay veredicto que dar', () => {
    expect(desgloseEsExacto(null)).toBe(false)
    expect(desgloseEsExacto(undefined)).toBe(false)
  })
})

describe('campoBloqueado — la vitrina del giro', () => {
  const activa = { status: 'ACTIVE' as const, activatedAt: '2026-09-20T00:00:00Z', redemptionCount: 5 }

  it('🔴 la vitrina NO se congela al activar: se mueve sobre campañas vivas', () => {
    expect(campoBloqueado('featuredForVertical', activa)).toBeNull()
  })

  it('🔴 mientras ocupa la vitrina, su giro no se cambia', () => {
    expect(campoBloqueado('vertical', { ...activa, featuredForVertical: true })).toMatch(/vitrina/)
    expect(campoBloqueado('vertical', { ...activa, featuredForVertical: false })).toBeNull()
  })

  it('una campaña terminada no se toca, tampoco su vitrina', () => {
    expect(campoBloqueado('featuredForVertical', { ...activa, status: 'ENDED' })).toBeTruthy()
  })
})
