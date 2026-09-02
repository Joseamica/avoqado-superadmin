import { api } from '@/shared/lib/api'
import type {
  ManualSpeiCaseDetail,
  ManualSpeiCasePage,
  ManualSpeiCaseStatus,
  ManualSpeiEvidenceAccess,
} from './types'

interface SuperadminEnvelope<T> {
  success: boolean
  data: T
}

export async function fetchManualSpeiCases(
  params: {
    status?: ManualSpeiCaseStatus
    cursor?: string
    limit?: number
  } = {},
): Promise<ManualSpeiCasePage> {
  const { data } = await api.get<SuperadminEnvelope<ManualSpeiCasePage>>(
    '/superadmin/commercial/billing/manual-spei/cases',
    { params: { ...params, limit: params.limit ?? 100 } },
  )
  return data.data
}

export async function fetchManualSpeiCase(caseId: string): Promise<ManualSpeiCaseDetail> {
  const { data } = await api.get<SuperadminEnvelope<ManualSpeiCaseDetail>>(
    `/superadmin/commercial/billing/manual-spei/cases/${encodeURIComponent(caseId)}`,
  )
  return data.data
}

export async function fetchManualSpeiEvidenceAccess(input: {
  evidenceId: string
  organizationId: string
  venueId: string
}): Promise<ManualSpeiEvidenceAccess> {
  const { data } = await api.get<SuperadminEnvelope<ManualSpeiEvidenceAccess>>(
    `/superadmin/commercial/billing/manual-spei/evidence/${encodeURIComponent(input.evidenceId)}/access`,
    { params: { organizationId: input.organizationId, venueId: input.venueId } },
  )
  const parsed = new URL(data.data.url)
  if (parsed.protocol !== 'https:') throw new Error('URL de evidencia no segura')
  return data.data
}

export interface ReviewManualSpeiEvidenceInput {
  evidenceId: string
  organizationId: string
  venueId: string
  action: 'ACCEPT' | 'REJECT'
  reason: string | null
}

export async function reviewManualSpeiEvidence(
  input: ReviewManualSpeiEvidenceInput,
): Promise<void> {
  const { evidenceId, ...body } = input
  await api.post(
    `/superadmin/commercial/billing/manual-spei/evidence/${encodeURIComponent(evidenceId)}/review`,
    body,
  )
}

export interface ApproveManualSpeiCaseInput {
  caseId: string
  organizationId: string
  venueId: string
  confirm: true
}

export async function approveManualSpeiCase(input: ApproveManualSpeiCaseInput): Promise<void> {
  const { caseId, ...body } = input
  await api.post(
    `/superadmin/commercial/billing/manual-spei/cases/${encodeURIComponent(caseId)}/approve`,
    body,
  )
}
