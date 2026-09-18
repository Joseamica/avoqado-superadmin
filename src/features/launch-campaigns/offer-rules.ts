import { centsToLabel, pesosInputToCents } from './money'
import { mexicoLocalToIso } from './datetime'
import type {
  LaunchCampaignChannel,
  LaunchCampaignPlanTier,
  LaunchCampaignStatus,
  LaunchCampaignVertical,
} from './types'

/**
 * Las reglas de la ficha, puras y sin React.
 *
 * 🔴 El servidor sigue mandando: estas funciones existen para que el operador vea
 * el problema ANTES de guardar, no para sustituir la validación de allá. Toda
 * regla de aquí tiene su gemela en el Zod y en el servicio de `avoqado-server`
 * (§3.4), y donde las dos pueden discrepar —el cupo contra el conteo vivo— gana
 * el `UPDATE` condicional del servidor, porque entre esta pantalla y la escritura
 * cabe una reserva nueva.
 *
 * Están extraídas del componente justamente para poder probarlas y romperlas a
 * propósito: dentro del JSX, "el botón se deshabilita" no se puede ejercitar sin
 * montar medio editor.
 */

/** Espejo de `LAUNCH_CAMPAIGN_CODE_RE` del servidor. */
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/
/** Espejo de `LANDING_SLUG_RE`. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Stripe no cobra menos de $10.00 MXN. */
export const MIN_ADVERTISED_CENTS = 1000
export const MAX_ADVERTISED_CENTS = 10_000_000
export const MAX_DISCOUNT_MONTHS = 24
export const MAX_CAP = 100_000

/** Lo que el editor tiene en pantalla: todo texto, como lo teclea una persona. */
export interface BorradorCampana {
  code: string
  name: string
  landingSlug: string
  vertical: LaunchCampaignVertical
  channel: LaunchCampaignChannel | ''
  planTier: LaunchCampaignPlanTier
  /** En PESOS, tal como se teclea. Se convierte en la frontera con `pesosInputToCents`. */
  advertisedPrice: string
  discountMonths: string
  redemptionCap: string
  /** `datetime-local`, hora de la Ciudad de México. */
  validFrom: string
  validUntil: string
  headline: string
  subheadline: string
  bullets: string[]
}

export type CampoDeCampana = keyof BorradorCampana

export interface ContextoDeValidacion {
  /**
   * Precio de lista del plan en centavos, según la vista previa del servidor.
   * Nulo mientras la vista previa no contesta.
   */
  listPriceCents?: number | null
  /** Lugares ya vivos (RESERVED + APPLIED) de una ficha existente. */
  redemptionCount?: number
}

export type ErroresDeCampana = Partial<Record<CampoDeCampana, string>>

function enteroDe(texto: string): number | null {
  const limpio = texto.trim()
  if (!/^\d+$/.test(limpio)) return null
  return Number(limpio)
}

/**
 * Todo lo que impide guardar, por campo.
 *
 * 🔴 La regla que da nombre a la pantalla: el precio anunciado, el plan y el
 * descuento tienen que poder convertirse en un cupón de Stripe. El cupón es
 * `amount_off = precio de lista − precio anunciado`, así que un anunciado igual o
 * mayor que la lista NO es un descuento: el servidor lo rechaza al activar con
 * `PLAN_PRICE_UNAVAILABLE`, y sin este aviso el operador se entera hasta ese
 * momento, con la ficha ya guardada y el anuncio ya escrito.
 */
export function problemasDeLaCampana(
  b: BorradorCampana,
  ctx: ContextoDeValidacion = {},
): ErroresDeCampana {
  const e: ErroresDeCampana = {}

  const code = b.code.trim().toUpperCase()
  if (!CODE_RE.test(code)) {
    e.code = 'De 3 a 32 letras, números, guiones o guiones bajos. Empieza con letra o número.'
  }

  const name = b.name.trim()
  if (name.length < 3 || name.length > 80) e.name = 'De 3 a 80 caracteres.'

  const slug = b.landingSlug.trim().toLowerCase()
  if (slug.length < 3 || slug.length > 60 || !SLUG_RE.test(slug)) {
    e.landingSlug = 'Minúsculas y números separados por un guion. Ejemplo: pos-22.'
  }

  // ---- La oferta: precio anunciado ----
  let advertisedCents: number | null = null
  try {
    advertisedCents = pesosInputToCents(b.advertisedPrice)
  } catch {
    e.advertisedPrice = 'Escribe una cantidad en pesos. Ejemplo: 22 o 22.50.'
  }

  if (advertisedCents !== null) {
    if (advertisedCents < MIN_ADVERTISED_CENTS) {
      e.advertisedPrice = `Stripe no cobra menos de $10.00 MXN: el mínimo es ${centsToLabel(MIN_ADVERTISED_CENTS)}.`
    } else if (advertisedCents > MAX_ADVERTISED_CENTS) {
      e.advertisedPrice = `El máximo es ${centsToLabel(MAX_ADVERTISED_CENTS)}.`
    } else if (
      // Sin el precio de lista no hay veredicto que dar. Inventarlo en un sentido
      // bloquea una campaña buena; en el otro deja pasar una imposible.
      typeof ctx.listPriceCents === 'number' &&
      advertisedCents >= ctx.listPriceCents
    ) {
      e.advertisedPrice =
        `Tiene que ser menor que el precio de lista del plan (${centsToLabel(ctx.listPriceCents)}). ` +
        'El cupón es la diferencia entre los dos: sin diferencia no hay descuento que aplicar.'
    }
  }

  const meses = enteroDe(b.discountMonths)
  if (meses === null || meses < 1 || meses > MAX_DISCOUNT_MONTHS) {
    e.discountMonths = `Un número entero de 1 a ${MAX_DISCOUNT_MONTHS}.`
  }

  // ---- El cupo ----
  const cap = enteroDe(b.redemptionCap)
  if (cap === null || cap < 1 || cap > MAX_CAP) {
    e.redemptionCap = `Un número entero de 1 a ${MAX_CAP.toLocaleString('es-MX')}.`
  } else if (typeof ctx.redemptionCount === 'number' && cap < ctx.redemptionCount) {
    e.redemptionCap =
      `Ya hay ${ctx.redemptionCount} lugares tomados: el cupo no puede quedar por debajo. ` +
      'Terminar la campaña sí cierra las altas nuevas.'
  }

  // ---- La vigencia ----
  const desde = mexicoLocalToIso(b.validFrom)
  const hasta = mexicoLocalToIso(b.validUntil)
  if (!desde) e.validFrom = 'Pon la fecha y la hora en que arranca.'
  if (!hasta) e.validUntil = 'Pon la fecha y la hora en que termina.'
  if (desde && hasta && new Date(hasta) <= new Date(desde)) {
    e.validUntil = 'La vigencia tiene que terminar después de empezar.'
  }

  // ---- Los textos del anuncio ----
  if (b.headline.trim().length > 120) e.headline = 'Máximo 120 caracteres.'
  if (b.subheadline.trim().length > 200) e.subheadline = 'Máximo 200 caracteres.'
  const bullets = b.bullets.map((x) => x.trim()).filter(Boolean)
  if (bullets.length > 6) e.bullets = 'Máximo 6 puntos.'
  else if (bullets.some((x) => x.length > 120)) e.bullets = 'Cada punto: máximo 120 caracteres.'

  return e
}

export function puedeGuardar(b: BorradorCampana, ctx: ContextoDeValidacion = {}): boolean {
  return Object.keys(problemasDeLaCampana(b, ctx)).length === 0
}

export interface EstadoDeLaFicha {
  status: LaunchCampaignStatus
  activatedAt: string | null
  redemptionCount: number
}

/**
 * Por qué un campo no se puede tocar, o `null` si sí se puede.
 *
 * Es la tabla de §2.1 del diseño, y el texto que devuelve es el que se pinta
 * junto al campo deshabilitado: un campo apagado sin explicación se lee como un
 * defecto de la pantalla, no como una regla.
 */
export function campoBloqueado(campo: CampoDeCampana, ficha: EstadoDeLaFicha): string | null {
  if (ficha.status === 'ENDED') {
    return 'La campaña ya terminó. Una ficha terminada se conserva como historia y no se edita.'
  }

  // El código viaja en anuncios, formularios y atribución: cambiarlo dejaría
  // huérfano todo lo que ya salió con él.
  if (campo === 'code') {
    return 'El código viaja en los anuncios y en la atribución: no cambia después de crear la ficha.'
  }

  const activada = ficha.activatedAt !== null

  if (campo === 'landingSlug' && activada) {
    return 'La dirección de la landing ya se publicó con este slug: no cambia después de la primera activación.'
  }

  if (campo === 'planTier' || campo === 'advertisedPrice' || campo === 'discountMonths') {
    if (ficha.status !== 'DRAFT') {
      return 'La oferta de una campaña ya activada no se cambia: se termina esta ficha y se crea otra con otro código.'
    }
    return null
  }

  if (campo === 'validFrom' && ficha.status !== 'DRAFT' && ficha.redemptionCount > 0) {
    return 'Ya hay lugares tomados con esta vigencia: el inicio no se mueve.'
  }

  return null
}

/** El id con el que el servidor crea el cupón en Stripe: `LC_<code>_V<offerVersion>`. */
export function couponIdFor(code: string, offerVersion: number): string {
  return `LC_${code.trim().toUpperCase()}_V${offerVersion}`
}

/**
 * ¿El desglose de IVA que manda el servidor se sostiene al multiplicar?
 *
 * 🔴 La suma siempre cuadra por construcción (`iva = total − base`), así que
 * mostrarla nunca falla. Lo que puede no cuadrar es la MULTIPLICACIÓN, que es lo
 * que revisa un contador en el CFDI: un total de $22.00 sale de una base de
 * $18.97, y $18.97 × 1.16 = $22.01. Cuando no cuadra, el editor enseña el total
 * y CALLA el desglose, en vez de imprimir una cuenta que no se sostiene.
 *
 * El veredicto sale de los montos que devolvió el servidor. Ningún precio está
 * escrito aquí: cuál es el precio anunciado es un dato de la campaña.
 */
export function desgloseEsExacto(
  promo: { subtotalCents: number; ivaCents: number } | null | undefined,
): boolean {
  if (!promo) return false
  const total = promo.subtotalCents + promo.ivaCents
  return Math.round((promo.subtotalCents * 116) / 100) === total
}
