import { api } from '@/shared/lib/api'
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
}
const BASE = '/superadmin/hybrid-campaigns'
export async function fetchHybridCampaigns(query: {
  page: number
  pageSize: number
  q?: string
  status?: string
}) {
  return (await api.get<{ data: HybridPage<HybridCampaign> }>(BASE, { params: query })).data.data
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
export async function previewHybridCampaign(
  offer: HybridDefinition,
  selectedFeatureCodes: string[],
) {
  return (
    await api.post<{ data: HybridPreview }>('/superadmin/launch-campaigns/hybrid-preview', {
      offer,
      selectedFeatureCodes,
    })
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
