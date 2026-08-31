/**
 * Lógica pura del editor completo de una cuenta de pago (`MerchantEditDrawer`).
 *
 * Vive en un `.ts` aparte para (a) poder probarla sin montar React y (b) que
 * react-refresh/only-export-components no se dispare en el `.tsx`.
 *
 * Dos reglas que aquí se hacen cumplir y que ya costaron caro antes:
 *
 *  1. **Las tasas se editan CRUDAS.** El borrador se siembra con
 *     `rawCardRates(cost)` (lo que persiste), nunca con la efectiva
 *     `cardRatesFromCost` — que aplica ×(1+IVA). Sembrar efectiva y guardar
 *     cruda duplica el IVA en cada ida y vuelta.
 *  2. **El parche sólo lleva lo que cambió.** El servidor discrimina
 *     `undefined` (no tocar) de `null` (borrar). Mandar el objeto completo
 *     haría que abrir y guardar sin editar nada reescribiera columnas — y en
 *     una cuenta de AngelPay escribiría columnas de Blumon.
 */
import type { UpdateMerchantInput } from './api'
import {
  CARD_TYPES,
  angelpayLoginIsEditable,
  rawCardRates,
  type CardRates,
  type CardType,
  type MerchantAccount,
  type ProviderCostStructure,
  type SettlementConfiguration,
  type SettlementDayType,
} from './types'

/** Qué juego de campos propios muestra el editor. */
export type ProviderKind = 'blumon' | 'angelpay' | 'generic'

/**
 * El proveedor se detecta por `code`, no por nombre ni por id: es el mismo
 * criterio que usa el backend (`PROVIDER_DEVICE_COMPATIBILITY`) y el
 * `payment-compat.ts` del feature venues. Un proveedor desconocido cae en
 * `generic` — se editan identidad, banco y credenciales, sin inventar campos.
 */
export function providerKind(code: string | null | undefined): ProviderKind {
  const c = (code ?? '').trim().toUpperCase()
  if (c === 'BLUMON') return 'blumon'
  if (c === 'ANGELPAY') return 'angelpay'
  return 'generic'
}

export const ZERO_RATES: CardRates = { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 }

/** Mismos defaults que el alta guiada, para que editar y dar de alta coincidan. */
export const DEFAULT_SETTLEMENT_DAYS: Record<CardType, number> = {
  DEBIT: 1,
  CREDIT: 1,
  AMEX: 3,
  INTERNATIONAL: 3,
}

export interface MerchantEditDraft {
  /* Identidad */
  externalMerchantId: string
  displayName: string
  alias: string
  /* Blumon */
  blumonSerialNumber: string
  blumonPosId: string
  blumonMerchantId: string
  blumonEnvironment: string
  /* AngelPay */
  angelpayAffiliation: string
  angelpayMerchantName: string
  /* Login de AngelPay (correo + PIN). El PIN actual NO vive aquí: se revela
     aparte. `angelpayNewPin` vacío = no rotar. */
  angelpayEmail: string
  angelpayEnvironment: string
  angelpayNewPin: string
  /* Banco */
  bankName: string
  clabeNumber: string
  accountHolder: string
  /* Credenciales — vacío = no rotar */
  credMerchantId: string
  credApiKey: string
  /* Tasas de costo del proveedor (CRUDAS) */
  rates: CardRates
  ratesIncludeTax: boolean
  /* Liquidación */
  settlementDays: Record<CardType, number>
  settlementDayType: SettlementDayType
  cutoffTime: string
}

const str = (v: string | null | undefined): string => v ?? ''

export function initMerchantEditDraft(
  m: MerchantAccount,
  cost: ProviderCostStructure | null,
  settlements: SettlementConfiguration[],
): MerchantEditDraft {
  const byCard = new Map(settlements.map((s) => [s.cardType, s]))
  const days = {} as Record<CardType, number>
  for (const card of CARD_TYPES) {
    days[card] = byCard.get(card)?.settlementDays ?? DEFAULT_SETTLEMENT_DAYS[card]
  }
  return {
    externalMerchantId: m.externalMerchantId,
    displayName: str(m.displayName),
    alias: str(m.alias),
    blumonSerialNumber: str(m.blumonSerialNumber),
    blumonPosId: str(m.blumonPosId),
    blumonMerchantId: str(m.blumonMerchantId),
    blumonEnvironment: str(m.blumonEnvironment),
    angelpayAffiliation: str(m.angelpayAffiliation),
    angelpayMerchantName: str(m.angelpayMerchantName),
    angelpayEmail: str(m.angelpayUserAccount?.email),
    angelpayEnvironment: str(m.angelpayUserAccount?.environment),
    angelpayNewPin: '',
    bankName: str(m.bankName),
    clabeNumber: str(m.clabeNumber),
    accountHolder: str(m.accountHolder),
    credMerchantId: '',
    credApiKey: '',
    // CRUDAS. Ver la regla 1 del encabezado.
    rates: cost ? rawCardRates(cost) : ZERO_RATES,
    ratesIncludeTax: cost?.includesTax ?? true,
    settlementDays: days,
    settlementDayType: settlements[0]?.settlementDayType ?? 'BUSINESS_DAYS',
    cutoffTime: settlements[0]?.cutoffTime || '23:00',
  }
}

/** Campos propios de cada proveedor, para no escribir columnas de un proveedor ajeno. */
const BLUMON_FIELDS = [
  ['blumonSerialNumber', 'blumonSerialNumber'],
  ['blumonPosId', 'blumonPosId'],
  ['blumonMerchantId', 'blumonMerchantId'],
  ['blumonEnvironment', 'blumonEnvironment'],
] as const
const ANGELPAY_FIELDS = [
  ['angelpayAffiliation', 'angelpayAffiliation'],
  ['angelpayMerchantName', 'angelpayMerchantName'],
] as const
const BANK_FIELDS = [
  ['bankName', 'bankName'],
  ['clabeNumber', 'clabeNumber'],
  ['accountHolder', 'accountHolder'],
] as const

/**
 * Parche para `PUT /superadmin/merchant-accounts/:id`. Sólo lleva las llaves
 * que de verdad cambiaron; el resto queda `undefined` = intacto en el servidor.
 * Un campo que se vació viaja como `null` (borrar), no como `''`.
 */
export function buildIdentityPatch(
  draft: MerchantEditDraft,
  original: MerchantAccount,
  kind: ProviderKind,
): UpdateMerchantInput {
  const patch: UpdateMerchantInput = {}

  if (draft.externalMerchantId.trim() !== original.externalMerchantId) {
    patch.externalMerchantId = draft.externalMerchantId.trim()
  }
  if (draft.displayName.trim() !== str(original.displayName)) {
    patch.displayName = draft.displayName.trim() || null
  }
  if (draft.alias.trim() !== str(original.alias)) {
    patch.alias = draft.alias.trim() || null
  }

  const groups = [
    ...(kind === 'blumon' ? BLUMON_FIELDS : []),
    ...(kind === 'angelpay' ? ANGELPAY_FIELDS : []),
    ...BANK_FIELDS,
  ] as ReadonlyArray<readonly [keyof MerchantEditDraft, keyof UpdateMerchantInput]>

  for (const [from, to] of groups) {
    const next = String(draft[from] ?? '').trim()
    const prev = str(original[to as keyof MerchantAccount] as string | null)
    if (next !== prev) {
      ;(patch as Record<string, unknown>)[to] = next || null
    }
  }

  // Credenciales: sólo si el operador escribió algo. El servidor las mezcla con
  // las existentes, así que rotar sólo el apiKey es válido.
  const credentials: Record<string, string> = {}
  if (draft.credMerchantId.trim()) credentials.merchantId = draft.credMerchantId.trim()
  if (draft.credApiKey.trim()) credentials.apiKey = draft.credApiKey.trim()
  if (Object.keys(credentials).length > 0) patch.credentials = credentials

  return patch
}

/** Mensaje del primer problema encontrado, o `null` si el borrador es válido. */
export function validateMerchantEditDraft(
  draft: MerchantEditDraft,
  kind: ProviderKind,
): string | null {
  if (!draft.externalMerchantId.trim()) return 'El ID de comercio es obligatorio'

  const clabe = draft.clabeNumber.trim()
  if (clabe && !/^\d{18}$/.test(clabe)) return 'El CLABE debe tener exactamente 18 dígitos'

  if (kind === 'blumon' && draft.blumonEnvironment) {
    if (!['SANDBOX', 'PRODUCTION'].includes(draft.blumonEnvironment)) {
      return 'El ambiente debe ser Sandbox o Producción'
    }
  }

  if (kind === 'angelpay') {
    const pin = draft.angelpayNewPin.trim()
    if (pin && !ANGELPAY_PIN_REGEX.test(pin)) {
      return 'El PIN de AngelPay son exactamente 6 dígitos'
    }
    const email = draft.angelpayEmail.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'El correo de la cuenta AngelPay no es válido'
    }
  }

  for (const card of CARD_TYPES) {
    const d = draft.settlementDays[card]
    if (!Number.isInteger(d) || d < 0) return 'Los días de liquidación deben ser enteros ≥ 0'
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.cutoffTime.trim())) {
    return 'La hora de corte debe ir en formato HH:MM (24 h)'
  }

  return null
}

/** ¿Cambió alguna tasa de costo o el flag de IVA? Sin esto no se toca la estructura. */
export function costChanged(draft: MerchantEditDraft, cost: ProviderCostStructure | null): boolean {
  const base = cost ? rawCardRates(cost) : ZERO_RATES
  const baseTax = cost?.includesTax ?? true
  if (draft.ratesIncludeTax !== baseTax) return true
  return CARD_TYPES.some((c) => draft.rates[c] !== base[c])
}

/** ¿Cambió algún día, el tipo de día o la hora de corte? */
export function settlementChanged(
  draft: MerchantEditDraft,
  settlements: SettlementConfiguration[],
): boolean {
  const byCard = new Map(settlements.map((s) => [s.cardType, s]))
  if (settlements.length === 0) {
    // Sin configuración previa: sólo cuenta como cambio si el operador movió algo
    // respecto del default que se le mostró.
    return (
      CARD_TYPES.some((c) => draft.settlementDays[c] !== DEFAULT_SETTLEMENT_DAYS[c]) ||
      draft.settlementDayType !== 'BUSINESS_DAYS' ||
      draft.cutoffTime.trim() !== '23:00'
    )
  }
  if (draft.settlementDayType !== (settlements[0]?.settlementDayType ?? 'BUSINESS_DAYS'))
    return true
  if (draft.cutoffTime.trim() !== (settlements[0]?.cutoffTime || '23:00')) return true
  return CARD_TYPES.some(
    (c) =>
      draft.settlementDays[c] !== (byCard.get(c)?.settlementDays ?? DEFAULT_SETTLEMENT_DAYS[c]),
  )
}

/* --- Login de AngelPay (correo + PIN) --- */

/** Sólo dígitos, exactamente 6 — mismo criterio que el `PIN_REGEX` del backend. */
export const ANGELPAY_PIN_REGEX = /^\d{6}$/

/**
 * Parche de correo/ambiente para `PATCH /angelpay-accounts/:id/credentials`,
 * o `null` si no hay nada que mandar.
 *
 * Devuelve `null` también cuando la cuenta ya NO es editable (el backend sólo
 * acepta cambios en `PENDING_PIN`): la pantalla la pone en sólo lectura, y esto
 * es el cinturón — mejor no mandar nada que comerse un 400 al guardar.
 */
export function angelpayCredentialsPatch(
  draft: MerchantEditDraft,
  original: MerchantAccount,
): { email?: string; environment?: 'QA' | 'PROD' } | null {
  const account = original.angelpayUserAccount
  if (!account) return null
  if (!angelpayLoginIsEditable(account.status)) return null

  const patch: { email?: string; environment?: 'QA' | 'PROD' } = {}
  const email = draft.angelpayEmail.trim()
  if (email && email !== account.email) patch.email = email

  const env = draft.angelpayEnvironment.trim()
  if ((env === 'QA' || env === 'PROD') && env !== account.environment) patch.environment = env

  return Object.keys(patch).length > 0 ? patch : null
}

/** PIN a fijar, o `null` si el operador no escribió uno nuevo. */
export function angelpayPinToSet(draft: MerchantEditDraft): string | null {
  const pin = draft.angelpayNewPin.trim()
  return pin ? pin : null
}
