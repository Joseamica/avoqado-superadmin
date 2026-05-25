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
  terminals: { id: string; serialNumber: string }[]
  counts: { costStructures: number; venueConfigs: number; terminals: number }
  createdAt: string
  updatedAt: string
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

export function cardRatesFromCost(cost: ProviderCostStructure): CardRates {
  return {
    DEBIT: effectiveRate(cost.debitRate, cost.includesTax, cost.taxRate),
    CREDIT: effectiveRate(cost.creditRate, cost.includesTax, cost.taxRate),
    AMEX: effectiveRate(cost.amexRate, cost.includesTax, cost.taxRate),
    INTERNATIONAL: effectiveRate(cost.internationalRate, cost.includesTax, cost.taxRate),
  }
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
  return {
    DEBIT: effectiveRate(p.debitRate, p.includesTax, p.taxRate),
    CREDIT: effectiveRate(p.creditRate, p.includesTax, p.taxRate),
    AMEX: effectiveRate(p.amexRate, p.includesTax, p.taxRate),
    INTERNATIONAL: effectiveRate(p.internationalRate, p.includesTax, p.taxRate),
  }
}
