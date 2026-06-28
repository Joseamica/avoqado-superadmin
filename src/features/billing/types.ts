/**
 * Platform Billing CFDI — frontend types (mirror of avoqado-server
 * src/services/superadmin/platform-billing/* + the Prisma models).
 *
 * "Platform billing" = Avoqado (the company) issuing CFDIs to ITS OWN customers
 * (orgs, venues, or external/standalone buyers) for the subscription fee, setup,
 * TPV hardware, etc. Money fields from the API are integer cents, MXN.
 */

export type BillingCustomerKind = 'ORGANIZATION' | 'VENUE' | 'STANDALONE'
export type PlatformCfdiStatus =
  | 'DRAFT'
  | 'STAMPING'
  | 'STAMPED'
  | 'STAMP_FAILED'
  | 'CANCEL_REQUESTED'
  | 'CANCELLED'
export type PlatformCfdiType = 'INGRESO' | 'PAGO'
export type CsdStatus = 'NONE' | 'UPLOADED' | 'ACTIVE' | 'EXPIRED' | 'RESTRICTED'

export interface PlatformEmisor {
  id: string
  rfc: string
  legalName: string
  regimenFiscal: string
  lugarExpedicion: string
  provider: string
  providerOrgId: string | null
  csdStatus: CsdStatus
  csdExpiresAt: string | null
  csdLastCheckedAt: string | null
  serie: string
  defaultUsoCfdi: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface BillingTaxProfile {
  id: string
  customerType: BillingCustomerKind
  organizationId: string | null
  venueId: string | null
  displayName: string | null
  rfc: string
  razonSocial: string
  regimenFiscal: string
  codigoPostal: string
  defaultUsoCfdi: string
  email: string | null
  constanciaUrl: string | null
  validationStatus: string
  validatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PlatformCfdiLine {
  description: string
  satProductKey: string
  satUnitKey: string
  quantity: number
  unitPriceCents: number
  discountCents?: number
  taxRate?: number
  taxExempt?: boolean
}

export interface PlatformCfdi {
  id: string
  platformEmisorId: string
  billingTaxProfileId: string | null
  type: PlatformCfdiType
  parentPlatformCfdiId: string | null
  organizationId: string | null
  venueId: string | null
  receptorRfc: string
  receptorNombre: string
  receptorRegimen: string
  receptorCp: string
  usoCfdi: string
  lines: PlatformCfdiLine[] | null
  formaPago: string
  metodoPago: 'PUE' | 'PPD'
  subtotalCents: number
  discountCents: number
  taxCents: number
  totalCents: number
  currency: string
  amountPaidCents: number
  paymentInfo?: {
    fechaPago?: string
    formaPago?: string
    montoCents?: number
    parcialidad?: number
  } | null
  status: PlatformCfdiStatus
  facturapiId: string | null
  uuid: string | null
  serie: string | null
  folio: string | null
  stampedAt: string | null
  cancelMotivo: string | null
  cancelStatus: string | null
  cancelledAt: string | null
  emailSentAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomerSearchRow {
  type: BillingCustomerKind
  id: string
  name: string
  rfc?: string | null
  hasProfile: boolean
}

// ── Badge tone maps (mirror src/shared/ui/Badge.tsx tones) ───────────────────

export const CFDI_STATUS_TONE: Record<
  PlatformCfdiStatus,
  'muted' | 'success' | 'warn' | 'danger' | 'info' | 'accent'
> = {
  DRAFT: 'muted',
  STAMPING: 'info',
  STAMPED: 'success',
  STAMP_FAILED: 'danger',
  CANCEL_REQUESTED: 'warn',
  CANCELLED: 'muted',
}

const CFDI_STATUS_LABEL: Record<PlatformCfdiStatus, string> = {
  DRAFT: 'Borrador',
  STAMPING: 'Timbrando',
  STAMPED: 'Timbrada',
  STAMP_FAILED: 'Error al timbrar',
  CANCEL_REQUESTED: 'Cancelación pedida',
  CANCELLED: 'Cancelada',
}

export function humanizeCfdiStatus(status: PlatformCfdiStatus): string {
  return CFDI_STATUS_LABEL[status] ?? status
}

export const CSD_STATUS_TONE: Record<
  CsdStatus,
  'muted' | 'success' | 'warn' | 'danger' | 'info' | 'accent'
> = {
  NONE: 'muted',
  UPLOADED: 'info',
  ACTIVE: 'success',
  EXPIRED: 'danger',
  RESTRICTED: 'warn',
}

const CSD_STATUS_LABEL: Record<CsdStatus, string> = {
  NONE: 'Sin CSD',
  UPLOADED: 'CSD cargado',
  ACTIVE: 'CSD activo',
  EXPIRED: 'CSD expirado',
  RESTRICTED: 'CSD restringido',
}

export function humanizeCsdStatus(status: CsdStatus): string {
  return CSD_STATUS_LABEL[status] ?? status
}

const CUSTOMER_KIND_LABEL: Record<BillingCustomerKind, string> = {
  ORGANIZATION: 'Organización',
  VENUE: 'Venue',
  STANDALONE: 'Externo',
}

export function humanizeCustomerKind(kind: BillingCustomerKind): string {
  return CUSTOMER_KIND_LABEL[kind] ?? kind
}

/** Derived payment state for a PPD income CFDI (computed from amountPaidCents vs totalCents). */
export type PaymentState = 'NA' | 'PENDING' | 'PARTIAL' | 'PAID'

export function paymentState(cfdi: PlatformCfdi): PaymentState {
  if (cfdi.type !== 'INGRESO' || cfdi.metodoPago !== 'PPD') return 'NA'
  if (cfdi.amountPaidCents <= 0) return 'PENDING'
  if (cfdi.amountPaidCents >= cfdi.totalCents) return 'PAID'
  return 'PARTIAL'
}

export const PAYMENT_STATE_TONE: Record<
  PaymentState,
  'muted' | 'success' | 'warn' | 'danger' | 'info' | 'accent'
> = {
  NA: 'muted',
  PENDING: 'warn',
  PARTIAL: 'info',
  PAID: 'success',
}

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  NA: '—',
  PENDING: 'Pendiente',
  PARTIAL: 'Parcial',
  PAID: 'Pagada',
}
