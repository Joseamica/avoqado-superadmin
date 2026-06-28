/**
 * API client for the platform-billing feature.
 *
 * Hits the superadmin namespace `/api/v1/superadmin/billing/*` (SUPERADMIN-only,
 * cookie auth). Every endpoint returns the `{ success, data }` envelope — we
 * unwrap and return `data.data`.
 */
import { api } from '@/shared/lib/api'
import type {
  BillingCustomerKind,
  BillingTaxProfile,
  CustomerSearchRow,
  PlatformCfdi,
  PlatformEmisor,
} from './types'

interface Envelope<T> {
  success: boolean
  data: T
  meta?: { total: number; page: number; pageSize: number }
}

// ── Emisor ───────────────────────────────────────────────────────────────────

export async function fetchEmisor(): Promise<PlatformEmisor | null> {
  const { data } = await api.get<Envelope<PlatformEmisor | null>>('/superadmin/billing/emisor')
  return data.data
}

export interface UpsertEmisorPayload {
  rfc: string
  legalName: string
  regimenFiscal: string
  lugarExpedicion: string
  serie?: string
  defaultUsoCfdi?: string
}

export async function upsertEmisor(payload: UpsertEmisorPayload): Promise<PlatformEmisor> {
  const { data } = await api.put<Envelope<PlatformEmisor>>('/superadmin/billing/emisor', payload)
  return data.data
}

/** Provision in Facturapi (empty body) OR bind an existing org/key (manual). */
export async function provisionEmisor(
  payload: { providerOrgId?: string; liveKey?: string } = {},
): Promise<PlatformEmisor> {
  const { data } = await api.post<Envelope<PlatformEmisor>>(
    '/superadmin/billing/emisor/provision',
    payload,
  )
  return data.data
}

export async function uploadEmisorCsd(payload: {
  cerBase64: string
  keyBase64: string
  csdPassword: string
}): Promise<PlatformEmisor> {
  const { data } = await api.post<Envelope<PlatformEmisor>>(
    '/superadmin/billing/emisor/csd',
    payload,
  )
  return data.data
}

// ── Receptores (tax profiles) ────────────────────────────────────────────────

export async function searchCustomers(
  type: BillingCustomerKind | undefined,
  q: string,
): Promise<CustomerSearchRow[]> {
  const { data } = await api.get<Envelope<CustomerSearchRow[]>>('/superadmin/billing/customers', {
    params: { type, q },
  })
  return Array.isArray(data?.data) ? data.data : []
}

export async function fetchTaxProfileForCustomer(
  type: BillingCustomerKind,
  id: string,
): Promise<BillingTaxProfile | null> {
  const { data } = await api.get<Envelope<BillingTaxProfile | null>>(
    `/superadmin/billing/customers/${encodeURIComponent(type)}/${encodeURIComponent(id)}/tax-profile`,
  )
  return data.data
}

export async function fetchTaxProfileById(id: string): Promise<BillingTaxProfile | null> {
  const { data } = await api.get<Envelope<BillingTaxProfile | null>>(
    `/superadmin/billing/tax-profiles/${encodeURIComponent(id)}`,
  )
  return data.data
}

export interface UpsertTaxProfilePayload {
  customerType: BillingCustomerKind
  organizationId?: string | null
  venueId?: string | null
  displayName?: string | null
  rfc: string
  razonSocial: string
  regimenFiscal: string
  codigoPostal: string
  defaultUsoCfdi?: string
  email?: string | null
}

export async function upsertTaxProfile(
  payload: UpsertTaxProfilePayload,
): Promise<BillingTaxProfile> {
  const { data } = await api.put<Envelope<BillingTaxProfile>>(
    '/superadmin/billing/tax-profiles',
    payload,
  )
  return data.data
}

export async function attachConstancia(
  profileId: string,
  constanciaUrl: string,
): Promise<BillingTaxProfile> {
  const { data } = await api.post<Envelope<BillingTaxProfile>>(
    `/superadmin/billing/tax-profiles/${encodeURIComponent(profileId)}/constancia`,
    { constanciaUrl },
  )
  return data.data
}

// ── Facturas (CFDIs) ─────────────────────────────────────────────────────────

export interface IssueInvoicePayload {
  billingTaxProfileId: string
  lines: Array<{
    description: string
    satProductKey: string
    satUnitKey: string
    quantity: number
    unitPriceCents: number
    discountCents?: number
    taxRate?: number
    taxExempt?: boolean
  }>
  formaPago: string
  metodoPago: 'PUE' | 'PPD'
  serie?: string
  usoCfdi?: string
}

export async function issueInvoice(payload: IssueInvoicePayload): Promise<PlatformCfdi> {
  const { data } = await api.post<Envelope<PlatformCfdi>>('/superadmin/billing/invoices', payload)
  return data.data
}

export interface FetchInvoicesParams {
  status?: string
  type?: string
  organizationId?: string
  venueId?: string
  page?: number
  pageSize?: number
}

export async function fetchInvoices(
  params: FetchInvoicesParams = {},
): Promise<{ rows: PlatformCfdi[]; total: number }> {
  const { data } = await api.get<Envelope<PlatformCfdi[]>>('/superadmin/billing/invoices', {
    params: { ...params, pageSize: params.pageSize ?? 100 },
  })
  return { rows: Array.isArray(data?.data) ? data.data : [], total: data?.meta?.total ?? 0 }
}

export type InvoiceWithPayments = PlatformCfdi & { payments?: PlatformCfdi[] }

export async function fetchInvoice(id: string): Promise<InvoiceWithPayments> {
  const { data } = await api.get<Envelope<InvoiceWithPayments>>(
    `/superadmin/billing/invoices/${encodeURIComponent(id)}`,
  )
  return data.data
}

/** Register a payment against a PPD invoice → stamps a complemento de pago (REP). */
export async function registerPayment(
  id: string,
  payload: { paymentDate: string; formaPago: string },
): Promise<PlatformCfdi> {
  const { data } = await api.post<Envelope<PlatformCfdi>>(
    `/superadmin/billing/invoices/${encodeURIComponent(id)}/payments`,
    payload,
  )
  return data.data
}

export async function cancelInvoice(
  id: string,
  motivo: '01' | '02' | '03' | '04',
  substituteUuid?: string,
): Promise<PlatformCfdi> {
  const { data } = await api.post<Envelope<PlatformCfdi>>(
    `/superadmin/billing/invoices/${encodeURIComponent(id)}/cancel`,
    {
      motivo,
      substituteUuid,
    },
  )
  return data.data
}

/** Download the stamped PDF/XML (cookie-auth blob) and trigger a browser save. */
export async function downloadInvoiceArtifact(id: string, kind: 'pdf' | 'xml'): Promise<void> {
  const res = await api.get(`/superadmin/billing/invoices/${encodeURIComponent(id)}/${kind}`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cfdi-${id}.${kind}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
