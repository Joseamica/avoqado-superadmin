import { api } from '@/shared/lib/api'

export type DocumentProvider = 'ANGELPAY' | 'BLUMON'
export type DocumentEntityType = 'PERSONA_FISICA' | 'PERSONA_MORAL'
export type DocumentRequestStatus = 'DRAFT' | 'SUBMITTED' | 'REVOKED'
export type NotificationStatus = 'NONE' | 'PENDING' | 'SENT' | 'FAILED' | 'UNKNOWN'
export interface DocumentRequest {
  id: string
  provider: DocumentProvider
  entityType: DocumentEntityType
  businessName: string
  contactName: string | null
  email: string | null
  phone: string | null
  status: DocumentRequestStatus
  expiresAt: string
  submittedAt: string | null
  createdAt: string
  submissionVersion: number
  notification: {
    onboarding: NotificationStatus
    daniel: NotificationStatus
    attempts: number
    nextAttemptAt: string | null
  }
}
export interface RequestDocument {
  id: string
  key: string
  fileName: string
  mimeType: string
  sizeBytes: number
}
export interface RequestList {
  items: DocumentRequest[]
  total: number
  page: number
  pageSize: number
}
export interface RequestLink {
  request: DocumentRequest
  uploadUrl: string
}
const base = '/superadmin/document-requests'
const path = (id: string) => `${base}/${encodeURIComponent(id)}`
export async function listDocumentRequests(params: {
  page: number
  pageSize: number
  search: string
  status: string
}) {
  return (await api.get<RequestList>(base, { params })).data
}
export async function createDocumentRequest(payload: {
  provider: DocumentProvider
  entityType: DocumentEntityType
  businessName: string
}) {
  return (await api.post<RequestLink>(base, payload)).data
}
export async function getDocumentRequest(id: string) {
  return (await api.get<{ request: DocumentRequest; documents: RequestDocument[] }>(path(id))).data
}
export async function renewDocumentRequest(id: string) {
  return (await api.post<RequestLink>(`${path(id)}/renew`)).data
}
export async function revokeDocumentRequest(id: string) {
  return (await api.post<{ request: DocumentRequest }>(`${path(id)}/revoke`)).data
}
export async function downloadRequestDocument(id: string, documentId: string) {
  return (
    await api.get<{ url: string }>(
      `${path(id)}/documents/${encodeURIComponent(documentId)}/download`,
    )
  ).data
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
export interface DocumentRequestSelection {
  id: string
  submissionVersion: number
  confirmed: true
}
export interface VenueDocumentOption {
  id: string
  name: string
  slug: string
  organizationId: string
  organizationName: string
  entityType: DocumentEntityType | null
}
export interface VenueDocumentLink {
  id: string
  requestId: string
  submissionVersion: number
  linkedAt: string
  provider: DocumentProvider
  entityType: DocumentEntityType
  businessName: string
  venue: Omit<VenueDocumentOption, 'entityType'>
}
export interface LinkedDocumentDetail {
  link: VenueDocumentLink
  request: Pick<
    DocumentRequest,
    | 'businessName'
    | 'contactName'
    | 'email'
    | 'phone'
    | 'provider'
    | 'entityType'
    | 'submissionVersion'
    | 'submittedAt'
  >
  documents: RequestDocument[]
}
export const DOCUMENT_REQUESTS_KEY = ['superadmin', 'document-requests'] as const
export function requestSummary(request: Pick<DocumentRequest, 'provider' | 'entityType'>) {
  return `${request.provider === 'ANGELPAY' ? 'AngelPay' : 'Blumon'} · Persona ${request.entityType === 'PERSONA_FISICA' ? 'física' : 'moral'}`
}
export async function listVenueDocumentOptions(params: {
  search: string
  page: number
  pageSize: number
}) {
  return (await api.get<Page<VenueDocumentOption>>(`${base}/venue-options`, { params })).data
}
export async function listRequestVenueLinks(
  id: string,
  params: { page: number; pageSize: number },
) {
  return (await api.get<Page<VenueDocumentLink>>(`${path(id)}/venue-links`, { params })).data
}
export async function linkRequestToVenue(
  id: string,
  payload: { venueId: string; submissionVersion: number; confirmed: true },
) {
  return (
    await api.post<{ link: VenueDocumentLink; created: boolean }>(
      `${path(id)}/venue-links`,
      payload,
    )
  ).data
}
const venuePath = (venueId: string) => `${base}/venues/${encodeURIComponent(venueId)}`
export async function listVenueDocumentLinks(
  venueId: string,
  params: { page: number; pageSize: number },
) {
  return (await api.get<Page<VenueDocumentLink>>(venuePath(venueId), { params })).data
}
export async function getLinkedDocumentDetail(venueId: string, linkId: string) {
  return (
    await api.get<LinkedDocumentDetail>(`${venuePath(venueId)}/links/${encodeURIComponent(linkId)}`)
  ).data
}
export async function downloadLinkedDocument(venueId: string, linkId: string, documentId: string) {
  return (
    await api.get<{ url: string }>(
      `${venuePath(venueId)}/links/${encodeURIComponent(linkId)}/documents/${encodeURIComponent(documentId)}/download`,
    )
  ).data
}

export interface PrivateDocumentPreviewData {
  url: string
  mimeType: string
  fileName: string
}
export async function previewRequestDocument(id: string, documentId: string) {
  return (
    await api.get<PrivateDocumentPreviewData>(
      `${path(id)}/documents/${encodeURIComponent(documentId)}/preview`,
    )
  ).data
}
export async function previewLinkedDocument(venueId: string, linkId: string, documentId: string) {
  return (
    await api.get<PrivateDocumentPreviewData>(
      `${venuePath(venueId)}/links/${encodeURIComponent(linkId)}/documents/${encodeURIComponent(documentId)}/preview`,
    )
  ).data
}
