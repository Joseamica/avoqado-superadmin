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
