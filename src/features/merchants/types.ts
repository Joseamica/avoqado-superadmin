/**
 * Tipos del feature Merchant Accounts. Mirror del backend
 * (`avoqado-server/prisma/schema.prisma`): MerchantAccount, PaymentProvider,
 * ProviderCostStructure, MerchantRevenueShare, SettlementConfiguration.
 *
 * Las tasas Decimal del backend llegan como `string` o `number` en JSON; aquí
 * las normalizamos a `number` (fracción 0..1, ej. 0.025 = 2.5%).
 */

export type CardType = 'DEBIT' | 'CREDIT' | 'AMEX' | 'INTERNATIONAL'
export const CARD_TYPES: readonly CardType[] = ['DEBIT', 'CREDIT', 'AMEX', 'INTERNATIONAL']

export type CardRates = Record<CardType, number>

export type ProviderType = 'PAYMENT_PROCESSOR' | 'BANK_DIRECT' | 'WALLET' | 'GATEWAY' | 'OTHER'
export type AccountSlot = 'PRIMARY' | 'SECONDARY' | 'TERTIARY'

export interface MerchantProvider {
  id: string
  code: string // "BLUMON", "ANGELPAY", …
  name: string
  type: ProviderType
}

export interface MerchantVenueRef {
  id: string
  name: string
  slug: string
}

/** Shape de cada fila de `GET /superadmin/merchant-accounts` (credenciales NO incluidas). */
export interface MerchantAccount {
  id: string
  provider: MerchantProvider
  externalMerchantId: string
  alias: string | null
  displayName: string | null
  active: boolean
  displayOrder: number
  clabeNumber: string | null
  bankName: string | null
  accountHolder: string | null
  hasCredentials: boolean
  // Blumon
  blumonSerialNumber: string | null
  blumonPosId: string | null
  blumonEnvironment: string | null // "SANDBOX" | "PRODUCTION" | null
  blumonMerchantId: string | null
  // AngelPay
  angelpayAffiliation: string | null
  angelpayMerchantName: string | null
  aggregatorId: string | null
  venues: MerchantVenueRef[]
  terminals: { id: string; serialNumber: string; inherited: boolean }[]
  counts: { costStructures: number; venueConfigs: number; terminals: number }
  createdAt: string
  updatedAt: string
}

/** Terminal candidata a anexar a un merchant desde el detalle (`assignable-terminals`). */
export interface AssignableTerminal {
  id: string
  serialNumber: string
  name: string | null
  venueId: string
  venueName: string
  brand: string | null
}

export interface ProviderCostStructure {
  id: string
  merchantAccountId: string
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  includesTax: boolean | null
  taxRate: number
  fixedCostPerTransaction: number | null
  effectiveFrom: string
  effectiveTo: string | null
  active: boolean
}

export interface MerchantRevenueShare {
  id: string
  merchantAccountId: string
  aggregatorPrice: CardRates | null // null = venta directa
  aggregatorPriceIncludesTax: boolean
  avoqadoShareOfProviderMargin: number // 0..1
  avoqadoShareOfAggregatorMargin: number | null
  taxRate: number
  active: boolean
}

export type SettlementDayType = 'BUSINESS_DAYS' | 'CALENDAR_DAYS'

export interface SettlementConfiguration {
  id: string
  merchantAccountId: string
  cardType: CardType
  settlementDays: number
  settlementDayType: SettlementDayType
  cutoffTime: string
  cutoffTimezone: string
  effectiveFrom: string
  effectiveTo: string | null
}

/** Config de pago de un venue que referencia a esta cuenta + en qué slot. */
export interface MerchantVenueConfig {
  venueId: string
  venue: MerchantVenueRef
  slot: AccountSlot
}

/* --- Helpers de tasa --- */

/**
 * Tasa efectiva: si `includesTax === false`, la tasa guardada es base y se le
 * suma el impuesto (× (1 + taxRate)). Si es `true` o `null` (legacy), la tasa
 * ya es final. Mismo criterio que ProviderCostStructure/VenuePricingStructure.
 */
export function effectiveRate(rate: number, includesTax: boolean | null, taxRate: number): number {
  if (includesTax === false) return rate * (1 + taxRate)
  return rate
}

/**
 * Tasas CRUDAS (tal cual se persisten en el backend), sin aplicar IVA. Úsalo
 * para seedear inputs EDITABLES: el campo debe mostrar lo que se guarda y el
 * checkbox "incluyen IVA" decide la interpretación. Para display read-only o
 * cálculo de margen usa `cardRatesFromCost`/`cardRatesFromPricing` (efectivas).
 */
export function rawCardRates(o: {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
}): CardRates {
  return {
    DEBIT: o.debitRate,
    CREDIT: o.creditRate,
    AMEX: o.amexRate,
    INTERNATIONAL: o.internationalRate,
  }
}

/** Aplica el IVA por tarjeta (efectiva). Para alimentar la preview de economía. */
export function effectiveCardRates(
  rates: CardRates,
  includesTax: boolean | null,
  taxRate: number,
): CardRates {
  return {
    DEBIT: effectiveRate(rates.DEBIT, includesTax, taxRate),
    CREDIT: effectiveRate(rates.CREDIT, includesTax, taxRate),
    AMEX: effectiveRate(rates.AMEX, includesTax, taxRate),
    INTERNATIONAL: effectiveRate(rates.INTERNATIONAL, includesTax, taxRate),
  }
}

export function cardRatesFromCost(cost: ProviderCostStructure): CardRates {
  return effectiveCardRates(rawCardRates(cost), cost.includesTax, cost.taxRate)
}

/* --- Humanizers + tones --- */

type Tone = 'muted' | 'success' | 'warn' | 'danger' | 'info' | 'accent'

export function humanizeCardType(c: CardType): string {
  switch (c) {
    case 'DEBIT':
      return 'Débito'
    case 'CREDIT':
      return 'Crédito'
    case 'AMEX':
      return 'AMEX'
    case 'INTERNATIONAL':
      return 'Internacional'
  }
}

export function humanizeEnvironment(env: string | null): string {
  if (env === 'PRODUCTION') return 'Producción'
  if (env === 'SANDBOX') return 'Sandbox'
  return '—'
}

/** El ambiente es estado operativo: PROD = ok (success), SANDBOX = atención (warn). */
export function environmentTone(env: string | null): Tone {
  if (env === 'PRODUCTION') return 'success'
  if (env === 'SANDBOX') return 'warn'
  return 'muted'
}

/** Estado activo/inactivo: activo = success, inactivo = muted (sin juicio negativo). */
export function activeTone(active: boolean): Tone {
  return active ? 'success' : 'muted'
}

/* --- Venue Pricing Structure --- */

export interface VenuePricingStructure {
  id: string
  venueId: string
  accountType: AccountSlot
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  includesTax: boolean | null
  taxRate: number
  fixedFeePerTransaction: number | null
  monthlyServiceFee: number | null
  effectiveFrom: string
  effectiveTo: string | null
  active: boolean
}

export function cardRatesFromPricing(p: VenuePricingStructure): CardRates {
  return effectiveCardRates(rawCardRates(p), p.includesTax, p.taxRate)
}
