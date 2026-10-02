import { api } from '@/shared/lib/api'
import { inspectApiError } from '@/shared/lib/api-error'
export type HybridTerms = {
  currency: 'MXN'
  interval: 'MONTHLY'
  price: number
  taxIncluded: true
  promotionCycles: number | null
  renewal: { kind: 'SAME_PRICE' | 'END' } | { kind: 'REPRICE'; price: number }
}
export type HybridDefinition = { schemaVersion: 1; terms: HybridTerms } & (
  | { kind: 'PLAN'; planTier: 'PRO' | 'PREMIUM' }
  | { kind: 'FEATURES'; featureCodes: string[] }
  | { kind: 'CHOICE_BUNDLE'; choiceCount: number; eligibleFeatureCodes: string[] }
)
export type HybridStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED'
export interface HybridCampaign {
  id: string
  code: string
  slug: string
  name: string
  status: HybridStatus
  revision: number
  startsAt: string
  endsAt: string
  capacity: number
  reservedCount: number
  redeemedCount: number
  audience: 'ALL' | 'NEW_ORGANIZATIONS' | 'ORGANIZATIONS'
  eligibleOrganizationIds: string[]
  listed: boolean
  /** Set when a «% de descuento» group generated it: the group shows it once, in «Descuentos %». */
  promotionGroupId?: string | null
  draftDefinition: HybridDefinition
  publications?: {
    id: string
    version: number
    definition: HybridDefinition
    definitionHash: string
  }[]
}
export type HybridDraft = Omit<
  HybridCampaign,
  | 'id'
  | 'status'
  | 'revision'
  | 'reservedCount'
  | 'redeemedCount'
  | 'draftDefinition'
  | 'publications'
  | 'promotionGroupId'
> & { definition: HybridDefinition }
export interface HybridPage<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
export interface HybridFeature {
  id: string
  featureCode?: string | null
  name: string
  description: string
  offering: string
  requirement?: string
}
export interface HybridPreview {
  definitionHash: string
  terms: HybridTerms
  selection: {
    valid: boolean
    issues: { code: string; message: string }[]
    featureCodes: string[]
    requiredCount: number | null
  }
  requirements: { featureCode: string; message: string }[]
  /** Other ACTIVE promotions of the product in the reviewed window: a warning, never a block (older servers omit it). */
  overlaps?: { campaignId: string; name: string; price: number }[]
}
const BASE = '/superadmin/hybrid-campaigns'
export async function fetchHybridCampaigns(query: {
  page: number
  pageSize: number
  q?: string
  status?: string
  /** Leaves out the campaigns a «% de descuento» group owns (they show once, as their group). */
  excludeGrouped?: true
}) {
  const get = async (params: typeof query) =>
    (await api.get<{ data: HybridPage<HybridCampaign> }>(BASE, { params })).data.data
  try {
    return await get(query)
  } catch (error) {
    // A server from before the «% de descuento» groups refuses the filter (its list query is strict): list as before
    // the groups, which then also show here until that server is updated. Any other refusal is the caller's.
    const issue = inspectApiError(error)
    if (
      query.excludeGrouped &&
      issue.status === 400 &&
      issue.serverMessage?.includes('Filtro no admitido')
    )
      return get({ ...query, excludeGrouped: undefined })
    throw error
  }
}
export async function fetchHybridCampaign(id: string) {
  return (await api.get<{ data: HybridCampaign }>(`${BASE}/${id}`)).data.data
}
export async function saveHybridCampaign(draft: HybridDraft, current?: HybridCampaign) {
  return current
    ? (
        await api.put<{ data: HybridCampaign }>(`${BASE}/${current.id}`, {
          ...draft,
          expectedRevision: current.revision,
        })
      ).data.data
    : (await api.post<{ data: HybridCampaign }>(BASE, draft)).data.data
}
export async function publishHybridCampaign(campaign: HybridCampaign) {
  return (await api.post(`${BASE}/${campaign.id}/publish`, { expectedRevision: campaign.revision }))
    .data.data
}
export async function changeHybridStatus(
  campaign: HybridCampaign,
  status: Exclude<HybridStatus, 'DRAFT'>,
) {
  return (
    await api.post(`${BASE}/${campaign.id}/status`, {
      expectedRevision: campaign.revision,
      status,
      ...(status === 'ACTIVE' ? { publicationId: campaign.publications?.[0]?.id } : {}),
    })
  ).data.data
}
export async function fetchHybridCatalog(query: { page: number; pageSize: number; q?: string }) {
  return (await api.get<{ data: HybridPage<HybridFeature> }>(`${BASE}/catalog`, { params: query }))
    .data.data
}
/** The window (and the campaign under review) go in the query: an older server ignores them instead of refusing the body. */
export async function previewHybridCampaign(
  offer: HybridDefinition,
  selectedFeatureCodes: string[],
  window?: { campaignId?: string; startsAt: string; endsAt: string },
) {
  return (
    await api.post<{ data: HybridPreview }>(
      '/superadmin/launch-campaigns/hybrid-preview',
      { offer, selectedFeatureCodes },
      { params: window },
    )
  ).data.data
}
export const hybridPesos = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

export interface HybridRedemption {
  id: string
  status: 'RESERVED' | 'REDEEMED' | 'RELEASED'
  createdAt: string
  purchaseId: string
  venueId: string
  venueName: string
  purchaseStatus: string
  paymentExpiresAt: string | null
  lastIssue: string | null
  dueNow: string
}
export async function fetchHybridRedemptions(
  id: string,
  query: { page: number; pageSize: number; status?: string; q?: string },
) {
  return (
    await api.get<{ data: HybridPage<HybridRedemption> }>(`${BASE}/${id}/redemptions`, {
      params: query,
    })
  ).data.data
}

/** «% de descuento»: one PROMOTION per function with a list on sale, at that % off its list (spec §4.3). */
export type PercentTarget =
  | { kind: 'ALL_FEATURES' }
  | { kind: 'CATEGORIES'; categories: string[] }
  | { kind: 'FEATURES'; featureCodes: string[] }
export interface PercentPromotionInput {
  name: string
  percentOff: number
  target: PercentTarget
  startsAt: string
  endsAt: string
  /** null = the discount lasts forever; N = N months, then it renews at the list price. */
  promotionCycles: number | null
  capacityPerFeature: number
}
/** NO_LIST: no list on sale (missing or paused), omitted. BELOW_MINIMUM: under $10, blocks the group. */
export interface PercentPreviewRow {
  featureCode: string
  name: string
  listPrice: number | null
  price: number | null
  renewalPrice: number | null
  status: 'OK' | 'NO_LIST' | 'BELOW_MINIMUM'
  requires: string[]
  /** Other ACTIVE promotions of the function whose window meets this one: a warning, never a block (older servers omit it). */
  overlaps?: { campaignId: string; name: string; price: number }[]
}
export type PercentGroupStatus = 'ACTIVE' | 'PAUSED' | 'ENDED'
export interface PercentGroup {
  id: string
  name: string
  percentOff: number
  target: PercentTarget
  startsAt: string
  endsAt: string
  promotionCycles: number | null
  capacityPerFeature: number
  status: PercentGroupStatus
  revision: number
  /** How many functions (campaigns) it generated. */
  functions: number
  createdAt: string
}
export type PercentGroupDetail = Omit<PercentGroup, 'functions'> & {
  campaigns: (HybridCampaign & { publication: { definition: HybridDefinition } | null })[]
}
/** TanStack key of «Descuentos %» (the list and each group's detail). */
export const PERCENT_GROUPS = ['superadmin', 'hybrid-percent-groups'] as const
const PERCENT = '/superadmin/hybrid-pricing/percent'
const percentPath = (id: string) => `${PERCENT}/${encodeURIComponent(id)}`
export async function previewPercent(input: PercentPromotionInput) {
  return (
    await api.post<{ data: { rows: PercentPreviewRow[]; creatable: boolean } }>(
      `${PERCENT}/preview`,
      input,
    )
  ).data.data
}
export async function createPercent(input: PercentPromotionInput) {
  return (await api.post<{ data: { groupId: string; campaignIds: string[] } }>(PERCENT, input)).data
    .data
}
export async function fetchPercentGroups(query: { page: number; pageSize: number }) {
  return (await api.get<{ data: HybridPage<PercentGroup> }>(PERCENT, { params: query })).data.data
}
export async function fetchPercentGroup(id: string) {
  return (await api.get<{ data: PercentGroupDetail }>(percentPath(id))).data.data
}
export async function setPercentGroupStatus(group: PercentGroup, status: PercentGroupStatus) {
  return (
    await api.post<{ data: PercentGroup }>(`${percentPath(group.id)}/status`, {
      status,
      expectedRevision: group.revision,
    })
  ).data.data
}
export async function recalculatePercentGroup(group: PercentGroup) {
  return (
    await api.post<{ data: PercentGroup }>(`${percentPath(group.id)}/recalculate`, {
      expectedRevision: group.revision,
    })
  ).data.data
}
/** featureCode → name of every catalog function (the «Precios» board), to say what a function requires. */
export async function fetchFeatureNames() {
  const rows = (
    await api.get<{ data: { featureCode: string | null; name: string }[] }>(
      '/superadmin/hybrid-pricing',
    )
  ).data.data
  return new Map(
    rows.flatMap((row): [string, string][] =>
      row.featureCode ? [[row.featureCode, row.name]] : [],
    ),
  )
}
