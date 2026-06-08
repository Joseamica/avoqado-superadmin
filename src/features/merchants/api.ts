/**
 * API client del feature Merchants. Namespace único `/api/v1/superadmin/*`
 * (cookies HTTP-only). Mapea raw→dominio (Decimals string→number).
 */
import { api } from '@/shared/lib/api'
import type {
  AccountSlot,
  AssignableTerminal,
  CardRates,
  CardType,
  MerchantAccount,
  MerchantProvider,
  MerchantRevenueShare,
  MerchantVenueConfig,
  ProviderCostStructure,
  SettlementConfiguration,
  SettlementDayType,
  VenuePricingStructure,
} from './types'

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : fallback
}

/* --- Lista + detalle --- */

interface MerchantListResponse {
  success: boolean
  data: RawMerchant[]
  count: number
}
interface RawMerchant {
  id: string
  provider: { id: string; code: string; name: string; type: MerchantProvider['type'] }
  externalMerchantId: string
  alias: string | null
  displayName: string | null
  active: boolean
  displayOrder: number
  clabeNumber: string | null
  bankName: string | null
  accountHolder: string | null
  hasCredentials: boolean
  blumonSerialNumber: string | null
  blumonPosId: string | null
  blumonEnvironment: string | null
  blumonMerchantId: string | null
  angelpayAffiliation: string | null
  angelpayMerchantName: string | null
  aggregatorId: string | null
  venues: { id: string; name: string; slug: string }[]
  terminals: { id: string; serialNumber: string; inherited?: boolean }[]
  _count: { costStructures: number; venueConfigs: number; terminals: number }
  createdAt: string
  updatedAt: string
}

function mapMerchant(r: RawMerchant): MerchantAccount {
  return {
    id: r.id,
    provider: r.provider,
    externalMerchantId: r.externalMerchantId,
    alias: r.alias,
    displayName: r.displayName,
    active: r.active,
    displayOrder: r.displayOrder ?? 0,
    clabeNumber: r.clabeNumber,
    bankName: r.bankName,
    accountHolder: r.accountHolder,
    hasCredentials: r.hasCredentials ?? false,
    blumonSerialNumber: r.blumonSerialNumber,
    blumonPosId: r.blumonPosId,
    blumonEnvironment: r.blumonEnvironment,
    blumonMerchantId: r.blumonMerchantId,
    angelpayAffiliation: r.angelpayAffiliation,
    angelpayMerchantName: r.angelpayMerchantName,
    aggregatorId: r.aggregatorId,
    venues: r.venues ?? [],
    terminals: (r.terminals ?? []).map((t) => ({
      id: t.id,
      serialNumber: t.serialNumber,
      inherited: t.inherited ?? false,
    })),
    counts: {
      costStructures: r._count?.costStructures ?? 0,
      venueConfigs: r._count?.venueConfigs ?? 0,
      terminals: r._count?.terminals ?? 0,
    },
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

export interface FetchMerchantsParams {
  providerId?: string
  active?: boolean
}

export async function fetchMerchants(
  params: FetchMerchantsParams = {},
): Promise<MerchantAccount[]> {
  const { data } = await api.get<MerchantListResponse>('/superadmin/merchant-accounts', { params })
  if (!Array.isArray(data?.data)) return []
  return data.data.map(mapMerchant)
}

export async function fetchMerchant(id: string): Promise<MerchantAccount | null> {
  try {
    const { data } = await api.get<{ data: RawMerchant }>(
      `/superadmin/merchant-accounts/${encodeURIComponent(id)}`,
    )
    return data?.data ? mapMerchant(data.data) : null
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null
    throw error
  }
}

/* --- Providers (filtro + futuro form de alta) --- */

export async function fetchProviders(): Promise<MerchantProvider[]> {
  const { data } = await api.get<{ data: MerchantProvider[] }>('/superadmin/payment-providers', {
    params: { active: true },
  })
  return Array.isArray(data?.data) ? data.data : []
}

/* --- Costo del proveedor (estructura activa) --- */

export async function fetchActiveCost(
  merchantAccountId: string,
): Promise<ProviderCostStructure | null> {
  try {
    const { data } = await api.get<{ data: Record<string, unknown> | null }>(
      `/superadmin/cost-structures/active/${encodeURIComponent(merchantAccountId)}`,
    )
    const c = data?.data
    if (!c) return null
    return {
      id: String(c.id),
      merchantAccountId,
      debitRate: num(c.debitRate),
      creditRate: num(c.creditRate),
      amexRate: num(c.amexRate),
      internationalRate: num(c.internationalRate),
      includesTax: (c.includesTax as boolean | null) ?? null,
      taxRate: num(c.taxRate, 0.16),
      fixedCostPerTransaction:
        c.fixedCostPerTransaction == null ? null : num(c.fixedCostPerTransaction),
      effectiveFrom: String(c.effectiveFrom),
      effectiveTo: (c.effectiveTo as string | null) ?? null,
      active: (c.active as boolean) ?? true,
    }
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null
    throw error
  }
}

/* --- Revenue-share (split agregador) --- */

export async function fetchRevenueShare(
  merchantAccountId: string,
): Promise<MerchantRevenueShare | null> {
  const { data } = await api.get<{ data: Record<string, unknown> | null }>(
    '/superadmin/merchant-revenue-shares/by-merchant',
    { params: { merchantAccountId } },
  )
  const r = data?.data
  if (!r) return null
  const ap = r.aggregatorPrice as Record<string, unknown> | null
  const aggregatorPrice: CardRates | null = ap
    ? {
        DEBIT: num(ap.DEBIT),
        CREDIT: num(ap.CREDIT),
        AMEX: num(ap.AMEX),
        INTERNATIONAL: num(ap.INTERNATIONAL),
      }
    : null
  return {
    id: String(r.id),
    merchantAccountId,
    aggregatorPrice,
    aggregatorPriceIncludesTax: (r.aggregatorPriceIncludesTax as boolean) ?? false,
    avoqadoShareOfProviderMargin: num(r.avoqadoShareOfProviderMargin, 0.5),
    avoqadoShareOfAggregatorMargin:
      r.avoqadoShareOfAggregatorMargin == null ? null : num(r.avoqadoShareOfAggregatorMargin),
    taxRate: num(r.taxRate, 0.16),
    active: (r.active as boolean) ?? true,
  }
}

/* --- Liquidación (todas las configs del merchant) --- */

export async function fetchSettlements(
  merchantAccountId: string,
): Promise<SettlementConfiguration[]> {
  const { data } = await api.get<{ data: Record<string, unknown>[] }>(
    '/superadmin/settlement-configurations',
    { params: { merchantAccountId } },
  )
  if (!Array.isArray(data?.data)) return []
  return data.data.map((s) => ({
    id: String(s.id),
    merchantAccountId,
    cardType: s.cardType as SettlementConfiguration['cardType'],
    settlementDays: num(s.settlementDays),
    settlementDayType: s.settlementDayType as SettlementConfiguration['settlementDayType'],
    cutoffTime: String(s.cutoffTime ?? ''),
    cutoffTimezone: String(s.cutoffTimezone ?? 'America/Mexico_City'),
    effectiveFrom: String(s.effectiveFrom),
    effectiveTo: (s.effectiveTo as string | null) ?? null,
  }))
}

/* --- Venues que referencian a la cuenta + slot --- */

export async function fetchVenueConfigs(merchantAccountId: string): Promise<MerchantVenueConfig[]> {
  const { data } = await api.get<{ data: Record<string, unknown>[] }>(
    `/superadmin/venue-pricing/configs-by-merchant/${encodeURIComponent(merchantAccountId)}`,
  )
  if (!Array.isArray(data?.data)) return []
  return data.data.map((c) => {
    const venue = (c.venue as { id: string; name: string; slug: string }) ?? {
      id: '',
      name: '—',
      slug: '',
    }
    const slot: MerchantVenueConfig['slot'] =
      c.primaryAccountId === merchantAccountId
        ? 'PRIMARY'
        : c.secondaryAccountId === merchantAccountId
          ? 'SECONDARY'
          : 'TERTIARY'
    return { venueId: venue.id, venue, slot }
  })
}

/* --- Mutations (identidad) --- */

export interface MerchantCredentialsInput {
  merchantId: string
  apiKey: string
}

export interface CreateMerchantInput {
  providerId: string
  externalMerchantId: string
  alias?: string | null
  displayName?: string | null
  active?: boolean
  displayOrder?: number
  /** Requerido salvo cuenta Blumon-pending (con blumonSerialNumber y sin creds). */
  credentials?: MerchantCredentialsInput
  blumonSerialNumber?: string
  blumonEnvironment?: string
  blumonMerchantId?: string
}

export interface UpdateMerchantInput {
  externalMerchantId?: string
  alias?: string | null
  displayName?: string | null
  active?: boolean
  displayOrder?: number
}

export async function createMerchant(input: CreateMerchantInput): Promise<MerchantAccount> {
  const { data } = await api.post<{ data: RawMerchant }>('/superadmin/merchant-accounts', input)
  if (!data?.data) throw new Error('Server returned empty response for createMerchant')
  return mapMerchant(data.data)
}

export async function updateMerchant(
  id: string,
  input: UpdateMerchantInput,
): Promise<MerchantAccount> {
  const { data } = await api.put<{ data: RawMerchant }>(
    `/superadmin/merchant-accounts/${encodeURIComponent(id)}`,
    input,
  )
  if (!data?.data) throw new Error('Server returned empty response for updateMerchant')
  return mapMerchant(data.data)
}

export async function toggleMerchant(id: string): Promise<MerchantAccount> {
  const { data } = await api.patch<{ data: RawMerchant }>(
    `/superadmin/merchant-accounts/${encodeURIComponent(id)}/toggle`,
  )
  if (!data?.data) throw new Error('Server returned empty response for toggleMerchant')
  return mapMerchant(data.data)
}

export async function deleteMerchant(id: string): Promise<void> {
  await api.delete(`/superadmin/merchant-accounts/${encodeURIComponent(id)}`)
}

/* --- Gestión de terminales (anexar/quitar, el server preserva la herencia del slot) --- */

/** Anexa (`serves:true`) o quita (`serves:false`) una terminal a este merchant. */
export async function setTerminalServes(
  merchantId: string,
  terminalId: string,
  serves: boolean,
): Promise<void> {
  await api.put(
    `/superadmin/merchant-accounts/${encodeURIComponent(merchantId)}/terminals/${encodeURIComponent(terminalId)}`,
    { serves },
  )
}

/** Terminales brand-compatibles de los venues del merchant que aún no lo procesan. */
export async function fetchAssignableTerminals(merchantId: string): Promise<AssignableTerminal[]> {
  const { data } = await api.get<{ data: AssignableTerminal[] }>(
    `/superadmin/merchant-accounts/${encodeURIComponent(merchantId)}/assignable-terminals`,
  )
  return Array.isArray(data?.data) ? data.data : []
}

/* --- Mutations economía (F2) --- */

export interface SaveCostInput {
  rates: CardRates
  includesTax: boolean
  taxRate: number
  fixedCostPerTransaction?: number | null
}

/** PUT la estructura activa si `activeId`, si no POST una nueva (effectiveFrom=ahora). */
export async function saveCost(
  merchantAccountId: string,
  activeId: string | null,
  input: SaveCostInput,
): Promise<void> {
  const body = {
    merchantAccountId,
    debitRate: input.rates.DEBIT,
    creditRate: input.rates.CREDIT,
    amexRate: input.rates.AMEX,
    internationalRate: input.rates.INTERNATIONAL,
    includesTax: input.includesTax,
    taxRate: input.taxRate,
    fixedCostPerTransaction: input.fixedCostPerTransaction ?? undefined,
  }
  if (activeId) {
    await api.put(`/superadmin/cost-structures/${encodeURIComponent(activeId)}`, body)
  } else {
    await api.post('/superadmin/cost-structures', {
      ...body,
      effectiveFrom: new Date().toISOString(),
    })
  }
}

export interface SaveRevenueShareInput {
  aggregatorPrice: CardRates | null
  /** ¿El precio al agregador ya incluye IVA? `false` = base, el cálculo le suma IVA. */
  aggregatorPriceIncludesTax: boolean
  avoqadoShareOfProviderMargin: number
  avoqadoShareOfAggregatorMargin: number | null
  taxRate: number
}

export async function saveRevenueShare(
  merchantAccountId: string,
  existingId: string | null,
  input: SaveRevenueShareInput,
): Promise<void> {
  const body = {
    aggregatorPrice: input.aggregatorPrice,
    aggregatorPriceIncludesTax: input.aggregatorPriceIncludesTax,
    avoqadoShareOfProviderMargin: input.avoqadoShareOfProviderMargin,
    avoqadoShareOfAggregatorMargin: input.avoqadoShareOfAggregatorMargin,
    taxRate: input.taxRate,
    active: true,
  }
  if (existingId) {
    await api.put(`/superadmin/merchant-revenue-shares/${encodeURIComponent(existingId)}`, body)
  } else {
    await api.post('/superadmin/merchant-revenue-shares', { ...body, merchantAccountId })
  }
}

/* --- Venue pricing (F2B) --- */

export async function getActiveVenuePricing(
  venueId: string,
  accountType: AccountSlot,
): Promise<VenuePricingStructure | null> {
  try {
    const { data } = await api.get<{ data: Record<string, unknown> | null }>(
      `/superadmin/venue-pricing/structures/active/${encodeURIComponent(venueId)}/${accountType}`,
    )
    const p = data?.data
    if (!p) return null
    return {
      id: String(p.id),
      venueId,
      accountType,
      debitRate: num(p.debitRate),
      creditRate: num(p.creditRate),
      amexRate: num(p.amexRate),
      internationalRate: num(p.internationalRate),
      includesTax: (p.includesTax as boolean | null) ?? null,
      taxRate: num(p.taxRate, 0.16),
      fixedFeePerTransaction:
        p.fixedFeePerTransaction == null ? null : num(p.fixedFeePerTransaction),
      monthlyServiceFee: p.monthlyServiceFee == null ? null : num(p.monthlyServiceFee),
      effectiveFrom: String(p.effectiveFrom),
      effectiveTo: (p.effectiveTo as string | null) ?? null,
      active: (p.active as boolean) ?? true,
    }
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null
    throw error
  }
}

export interface SaveVenuePricingInput {
  rates: CardRates
  includesTax: boolean
  taxRate: number
  fixedFeePerTransaction?: number | null
  monthlyServiceFee?: number | null
}

export async function saveVenuePricing(
  venueId: string,
  accountType: AccountSlot,
  activeId: string | null,
  input: SaveVenuePricingInput,
): Promise<void> {
  const body = {
    venueId,
    accountType,
    debitRate: input.rates.DEBIT,
    creditRate: input.rates.CREDIT,
    amexRate: input.rates.AMEX,
    internationalRate: input.rates.INTERNATIONAL,
    includesTax: input.includesTax,
    taxRate: input.taxRate,
    fixedFeePerTransaction: input.fixedFeePerTransaction ?? undefined,
    monthlyServiceFee: input.monthlyServiceFee ?? undefined,
  }
  if (activeId) {
    await api.put(`/superadmin/venue-pricing/structures/${encodeURIComponent(activeId)}`, body)
  } else {
    await api.post('/superadmin/venue-pricing/structures', {
      ...body,
      effectiveFrom: new Date().toISOString(),
    })
  }
}

/* ─── Blumon full-setup (F5·A) ─── */

export interface VenueOption {
  id: string
  name: string
  slug: string
}

/** Tasas EN PORCENTAJE (el endpoint full-setup divide /100). NO decimal. */
export interface BlumonRateOverride {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  includesTax: boolean
  fixedCostPerTransaction?: number
  monthlyFee?: number
}
export interface BlumonPricingOverride {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  includesTax: boolean
  fixedFeePerTransaction?: number
  monthlyServiceFee?: number
}

export interface BlumonFullSetupPayload {
  serialNumber: string
  brand: string
  model: string
  displayName?: string
  environment: 'SANDBOX' | 'PRODUCTION'
  businessCategory?: string
  target: { type: 'venue'; id: string }
  accountSlot: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  additionalTerminalIds?: string[]
  costStructureOverrides?: BlumonRateOverride
  venuePricing?: BlumonPricingOverride
  settlementConfig?: {
    debitDays: number
    creditDays: number
    amexDays: number
    internationalDays: number
  }
}

/**
 * Resumen que devuelve `POST blumon/full-setup`. **No** es un `MerchantAccount`:
 * el endpoint orquesta varios writes y responde un resumen donde `terminals` es
 * un objeto de conteos. Pasarlo por `mapMerchant` reventaba con
 * `(r.terminals ?? []).map is not a function` aunque el merchant SÍ se creaba.
 */
interface BlumonFullSetupSummary {
  merchantAccount: { id: string; displayName: string | null; created: boolean }
  terminals: { autoAttached: number; batchAttached: number; total: number }
}

export interface BlumonFullSetupResult {
  merchantAccountId: string
  merchantCreated: boolean
  terminalsAttached: number
}

export async function fullSetupBlumon(
  payload: BlumonFullSetupPayload,
): Promise<BlumonFullSetupResult> {
  const { data } = await api.post<{ data: BlumonFullSetupSummary }>(
    '/superadmin/merchant-accounts/blumon/full-setup',
    payload,
  )
  const summary = data?.data
  if (!summary?.merchantAccount?.id) {
    throw new Error('Server returned empty response for fullSetupBlumon')
  }
  return {
    merchantAccountId: summary.merchantAccount.id,
    merchantCreated: summary.merchantAccount.created ?? false,
    terminalsAttached: summary.terminals?.total ?? 0,
  }
}

export async function fetchVenueOptions(): Promise<VenueOption[]> {
  const { data } = await api.get<{ data: Array<{ id: string; name: string; slug: string }> }>(
    '/dashboard/superadmin/venues',
  )
  if (!Array.isArray(data?.data)) return []
  return data.data.map((v) => ({ id: v.id, name: v.name, slug: v.slug }))
}

/** Terminal registrada de un venue, en su forma mínima para el wizard de alta. */
export interface WizardTerminal {
  id: string
  serialNumber: string | null
  name: string
  brand: string | null
  model: string | null
  type: string
  status: string
}

/**
 * Terminales registradas de un venue (para elegir la principal o atar extras en
 * el wizard). Reusa el endpoint double-mounted `/superadmin/terminals?venueId=`;
 * NO importamos el feature `terminals` (cross-feature import está prohibido) — sólo
 * mapeamos los campos que el wizard necesita.
 */
export async function fetchVenueTerminals(venueId: string): Promise<WizardTerminal[]> {
  const { data } = await api.get<{ data: Array<Record<string, unknown>> }>(
    '/superadmin/terminals',
    {
      params: { venueId },
    },
  )
  if (!Array.isArray(data?.data)) return []
  return data.data.map((t) => ({
    id: String(t.id),
    serialNumber: (t.serialNumber as string | null) ?? null,
    name: String(t.name ?? ''),
    brand: (t.brand as string | null) ?? null,
    model: (t.model as string | null) ?? null,
    type: String(t.type ?? ''),
    status: String(t.status ?? ''),
  }))
}

/* ─── AngelPay full-setup (F5·B) ─── */

export interface AngelPayAccountOption {
  id: string
  email: string
  status: string
  environment: string
}

interface AngelPayRatePayload {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  includesTax: boolean
  taxRate: number
  effectiveFrom: string
}

export interface AngelPayFullSetupPayload {
  venueId: string
  aggregatorId?: string
  login:
    | { mode: 'existing'; angelpayUserAccountId: string }
    | { mode: 'new'; email: string; pin: string; environment: 'QA' | 'PROD' }
  merchant:
    | {
        mode: 'create'
        externalMerchantId: string
        name: string
        affiliation: string
        displayName: string
      }
    | { mode: 'existing'; merchantAccountId: string }
  slot: {
    accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
    mode: 'fill' | 'replace'
    replacedAccountId?: string
  }
  terminalIds?: string[]
  cost?: AngelPayRatePayload
  pricing?: AngelPayRatePayload
  settlement?: {
    settlementDays: number
    settlementDaysByCard?: {
      DEBIT?: number
      CREDIT?: number
      AMEX?: number
      INTERNATIONAL?: number
    }
    settlementDayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
    cutoffTime: string
    cutoffTimezone: string
    effectiveFrom: string
  }
}

/** Resultado de `POST full-setup-angelpay` — tampoco es un `MerchantAccount`. */
export interface AngelPayFullSetupResult {
  merchantAccountId: string
  terminalsAttached: number
}

export async function fullSetupAngelPay(
  payload: AngelPayFullSetupPayload,
): Promise<AngelPayFullSetupResult> {
  const { data } = await api.post<{
    data: { merchantAccountId: string; terminalIds?: string[] }
  }>('/superadmin/merchant-accounts/full-setup-angelpay', payload)
  const result = data?.data
  if (!result?.merchantAccountId) {
    throw new Error('Server returned empty response for fullSetupAngelPay')
  }
  return {
    merchantAccountId: result.merchantAccountId,
    terminalsAttached: result.terminalIds?.length ?? 0,
  }
}

export async function fetchAngelPayAccounts(venueId: string): Promise<AngelPayAccountOption[]> {
  const { data } = await api.get<{
    data: Array<{ id: string; email: string; status: string; environment: string }>
  }>(`/superadmin/venues/${encodeURIComponent(venueId)}/angelpay-accounts`)
  if (!Array.isArray(data?.data)) return []
  return data.data.map((a) => ({
    id: a.id,
    email: a.email,
    status: a.status,
    environment: a.environment,
  }))
}

/* ── Rate correction (retroactive) ── */

export type MissingCostMode = 'FIX_PAYMENT_ONLY' | 'CREATE_COST'

export interface RateSetInput {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  includesTax?: boolean | null
  taxRate?: number | null
  fixedFeePerTransaction?: number | null
}

export interface RateCorrectionParams {
  accountType: AccountSlot
  newVenueRates?: RateSetInput
  newProviderRates?: RateSetInput
  dateFrom?: string
  dateTo?: string
  missingCostMode: MissingCostMode
}

export interface RateCorrectionPreview {
  merchantAccountId: string
  inScopeCount: number
  withCostCount: number
  missingCostCount: number
  beforeFeeTotal: number
  afterFeeTotal: number
  estimatedImpact: number
  negativeMarginCount: number
  costStructureAvailable: boolean
  venuePricingAvailable: boolean
}

export interface RateCorrectionBatch {
  id: string
  venueId: string
  merchantAccountId: string
  accountType: AccountSlot
  status: 'PENDING' | 'APPLIED' | 'FAILED' | 'REVERSED'
  paymentCount: number
  costCreatedCount: number
  estimatedImpact: number | string
  appliedAt: string | null
  reversedAt: string | null
  createdAt: string
  merchantAccount?: { id: string; displayName: string | null; alias: string | null }
  appliedBy?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  } | null
}

// Apply/reverse recompute hundreds of payments against the remote DB and can take
// ~10-30s. The global axios timeout is 20s, which aborts the request client-side
// even though the backend completes (surfacing a false "sin conexión" error). These
// long-running ops override it with a generous timeout so the client waits for the
// real response.
const RATE_CORRECTION_TIMEOUT_MS = 180_000

export async function previewRateCorrection(
  venueId: string,
  params: RateCorrectionParams,
): Promise<RateCorrectionPreview> {
  const { data } = await api.post<{ data: RateCorrectionPreview }>(
    `/superadmin/rate-corrections/venues/${encodeURIComponent(venueId)}/preview`,
    params,
    { timeout: RATE_CORRECTION_TIMEOUT_MS },
  )
  return data.data
}

export async function applyRateCorrection(
  venueId: string,
  params: RateCorrectionParams,
): Promise<RateCorrectionBatch> {
  const { data } = await api.post<{ data: RateCorrectionBatch }>(
    `/superadmin/rate-corrections/venues/${encodeURIComponent(venueId)}/apply`,
    params,
    { timeout: RATE_CORRECTION_TIMEOUT_MS },
  )
  return data.data
}

export async function reverseRateCorrection(batchId: string): Promise<RateCorrectionBatch> {
  const { data } = await api.post<{ data: RateCorrectionBatch }>(
    `/superadmin/rate-corrections/${encodeURIComponent(batchId)}/reverse`,
    {},
    { timeout: RATE_CORRECTION_TIMEOUT_MS },
  )
  return data.data
}

export async function listRateCorrections(venueId?: string): Promise<RateCorrectionBatch[]> {
  const { data } = await api.get<{ data: RateCorrectionBatch[] }>('/superadmin/rate-corrections', {
    params: venueId ? { venueId } : {},
  })
  return data.data
}

/* --- Holidays + settlement save (F3) --- */

export async function fetchHolidays(year: number, country = 'MX'): Promise<Set<string>> {
  const { data } = await api.get<{ data: { date: string; name: string }[] }>(
    '/superadmin/holidays',
    {
      params: { year, country },
    },
  )
  return new Set((data?.data ?? []).map((h) => h.date))
}

export interface SettlementRowInput {
  cardType: CardType
  settlementDays: number
  settlementDayType: SettlementDayType
}

/** Por tarjeta: PUT la config activa (id en `existingByCard`) o POST si no existe. */
export async function saveSettlement(
  merchantAccountId: string,
  rows: SettlementRowInput[],
  cutoffTime: string,
  cutoffTimezone: string,
  existingByCard: Record<string, string>,
): Promise<void> {
  for (const r of rows) {
    const body = {
      merchantAccountId,
      cardType: r.cardType,
      settlementDays: r.settlementDays,
      settlementDayType: r.settlementDayType,
      cutoffTime,
      cutoffTimezone,
    }
    const id = existingByCard[r.cardType]
    if (id) {
      await api.put(`/superadmin/settlement-configurations/${encodeURIComponent(id)}`, body)
    } else {
      await api.post('/superadmin/settlement-configurations', {
        ...body,
        effectiveFrom: new Date().toISOString(),
      })
    }
  }
}
