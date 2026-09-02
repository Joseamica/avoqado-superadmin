export type ManualSpeiCaseStatus =
  | 'PENDING_REVIEW'
  | 'AWAITING_APPROVAL'
  | 'READY_TO_RECONCILE'
  | 'RECONCILED'
  | 'REJECTED'

export type ManualSpeiExceptionReason =
  | 'AMOUNT_MISMATCH'
  | 'REFERENCE_MISSING'
  | 'ACCOUNT_MISMATCH'
  | 'DUPLICATE_SUSPECTED'
  | string

export interface ManualSpeiCaseSummary {
  id: string
  organizationId: string
  venueId: string
  receivableId: string
  paymentAttemptId: string
  policyVersionId: string
  observedAmountMinor: string
  currency: string
  bankReference: string | null
  observedAt: string
  createdById: string
  requiredApprovals: number
  exceptionReasons: ManualSpeiExceptionReason[]
  status: ManualSpeiCaseStatus
  reconciledReceiptId: string | null
  evidenceCount: number
  approvalCount: number
  createdAt: string
  updatedAt: string
}

export interface ManualSpeiEvidenceReview {
  id: string
  action: 'ACCEPT' | 'REJECT'
  actorId: string
  reason: string | null
  createdAt: string
}

export interface ManualSpeiEvidence {
  id: string
  sequence: number
  contentSha256: string
  mimeType: string
  sizeBytes: number
  uploadedById: string
  createdAt: string
  reviews: ManualSpeiEvidenceReview[]
}

export interface ManualSpeiApproval {
  id: string
  actorId: string
  policyVersionId: string
  exceptionReasons: ManualSpeiExceptionReason[]
  createdAt: string
}

export interface ManualSpeiCaseDetail extends ManualSpeiCaseSummary {
  receivingAccountFingerprint: string
  attributedCommercialActorIds: string[]
  evidence: ManualSpeiEvidence[]
  approvals: ManualSpeiApproval[]
}

export interface ManualSpeiCasePage {
  items: ManualSpeiCaseSummary[]
  nextCursor: string | null
}

export interface ManualSpeiEvidenceAccess {
  url: string
  expiresInMinutes: number
  mimeType: string
  sizeBytes: number
}

export const MANUAL_SPEI_STATUS_LABEL: Record<ManualSpeiCaseStatus, string> = {
  PENDING_REVIEW: 'Evidencia pendiente',
  AWAITING_APPROVAL: 'Esperando aprobación',
  READY_TO_RECONCILE: 'Lista para conciliar',
  RECONCILED: 'Conciliada',
  REJECTED: 'Rechazada',
}

export const EXCEPTION_REASON_LABEL: Record<string, string> = {
  AMOUNT_MISMATCH: 'Importe distinto',
  REFERENCE_MISSING: 'Referencia faltante',
  ACCOUNT_MISMATCH: 'Cuenta receptora distinta',
  DUPLICATE_SUSPECTED: 'Posible duplicado',
}
