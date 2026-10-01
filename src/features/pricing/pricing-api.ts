import { api } from '@/shared/lib/api'
import { apiErrorPayload } from '@/shared/lib/api-error'
import { formatDate } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'

/** One product of the «Precios» board. Money in pesos MXN, IVA included. */
export interface ListPriceRow {
  productKey: string
  featureCode: string | null
  planTier: 'PRO' | 'PREMIUM' | null
  name: string
  category: string
  minimumTier: string | null
  editable: boolean
  notEditableReason: 'FREE' | 'CONTACT' | 'SYSTEM' | 'PLAN_PHASE_2' | null
  campaignId: string | null
  revision: number | null
  status: 'ACTIVE' | 'PAUSED' | null
  price: number | null
  pendingPrice: number | null
  /** «% de descuento» groups on sale over it: after a list change they need «Recalcular» (optional: older servers). */
  activeGroups?: { id: string; name: string; revision: number }[]
}

export interface PriceGapSummaryRow {
  productKey: string
  /** Venues paying less than today's list, counted once. */
  venues: number
  /** Pesos with 2 decimals: a difference of RATES, not cash collected. */
  monthlyGap: string
  aboveListVenues: number
  bundleVenues: number
}

export type GapReason =
  | 'OLD_LIST'
  | 'PROMO_FOREVER'
  | 'PROMO_TEMPORARY'
  | 'RENEWED_OLD_LIST'
  | 'PROMO_ENDING'

/** One row per CONTRACT (a venue may hold two). Amounts are pesos as strings with 2 decimals. */
export interface PriceGapVenueRow {
  contractId: string
  venueId: string
  venueName: string
  organizationName: string
  rate: string
  listPrice: string
  gap: string
  since: string
  reason: GapReason
  reasonUntil: string | null
}

/** An active promotion a list price would break (409 `HYBRID_LIST_BREAKS_PROMOTIONS`), with what pausing it needs. */
export interface RuleViolation {
  campaignId: string
  campaignName: string
  price: number
  renewalPrice: number | null
  listPrice: number
  revision: number
  promotionGroupId: string | null
  groupRevision: number | null
}

const BASE = '/superadmin/hybrid-pricing'
export const GAP_PAGE_SIZE = 50
// Product keys travel URL-encoded: /lists/FEATURE%3ACFDI.
const path = (productKey: string) => `${BASE}/lists/${encodeURIComponent(productKey)}`

export const fetchPriceBoard = async () => (await api.get<{ data: ListPriceRow[] }>(BASE)).data.data

export const fetchPriceGaps = async () =>
  (await api.get<{ data: PriceGapSummaryRow[] }>(`${BASE}/gaps`)).data.data

export const fetchPriceGapVenues = async (productKey: string, page: number) =>
  (
    await api.get<{ data: { items: PriceGapVenueRow[]; total: number } }>(
      `${BASE}/gaps/${encodeURIComponent(productKey)}`,
      { params: { page, pageSize: GAP_PAGE_SIZE } },
    )
  ).data.data

export const saveListPrice = async (row: ListPriceRow, price: number) =>
  (
    await api.put<{ data: ListPriceRow }>(path(row.productKey), {
      price,
      expectedRevision: row.revision,
    })
  ).data.data

export const retryListPrice = async (productKey: string) =>
  (await api.post<{ data: ListPriceRow }>(`${path(productKey)}/retry`)).data.data

export const setListStatus = async (row: ListPriceRow, status: 'ACTIVE' | 'PAUSED') =>
  (
    await api.post<{ data: ListPriceRow }>(`${path(row.productKey)}/status`, {
      status,
      expectedRevision: row.revision,
    })
  ).data.data

/**
 * Pauses what a list price would break: a generated promotion through its group (once per group, whatever the number
 * of its functions), a manual one through its own campaign. Each write is conditional on the revision the 409 reported.
 */
export async function pausePromotions(violations: RuleViolation[]) {
  const groups = new Map<string, number | null>()
  const manual: RuleViolation[] = []
  for (const violation of violations) {
    if (violation.promotionGroupId) groups.set(violation.promotionGroupId, violation.groupRevision)
    else manual.push(violation)
  }
  await Promise.all([
    ...[...groups].map(([groupId, expectedRevision]) =>
      api.post(`${BASE}/percent/${encodeURIComponent(groupId)}/status`, {
        status: 'PAUSED',
        expectedRevision,
      }),
    ),
    ...manual.map((violation) =>
      api.post(`/superadmin/hybrid-campaigns/${encodeURIComponent(violation.campaignId)}/status`, {
        status: 'PAUSED',
        expectedRevision: violation.revision,
      }),
    ),
  ])
}

/** The server's machine-readable error: `{ code, details }` next to the message. */
export const pricingError = apiErrorPayload

/** Somebody else moved the list (or the promotion) since this screen read it. */
export const isStale = (code?: string) =>
  code === 'HYBRID_CAMPAIGN_STALE' || code === 'HYBRID_LIST_SUPERSEDED'

/** Why a contract pays less than today's list (spec §6.3). */
export function gapReasonLabel(row: Pick<PriceGapVenueRow, 'reason' | 'reasonUntil'>): string {
  switch (row.reason) {
    case 'OLD_LIST':
      return 'Precio de lista anterior'
    case 'PROMO_FOREVER':
      return 'Promoción para siempre'
    case 'PROMO_TEMPORARY':
      return `Promoción temporal (cambia el ${formatDate(row.reasonUntil)})`
    case 'RENEWED_OLD_LIST':
      return 'Renovó a una lista anterior'
    case 'PROMO_ENDING':
      return `Promoción que termina el ${formatDate(row.reasonUntil)}`
  }
}

/** «3 negocios con tarifa anterior · diferencia de tarifas: $300.00 al mes». */
export function gapNotice(summary: PriceGapSummaryRow): string {
  const venues = `${summary.venues} ${summary.venues === 1 ? 'negocio' : 'negocios'}`
  return `${venues} con tarifa anterior · diferencia de tarifas: ${formatMoney(Number(summary.monthlyGap))} al mes`
}
