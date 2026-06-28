import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  attachConstancia,
  cancelInvoice,
  fetchEmisor,
  fetchInvoice,
  fetchInvoices,
  issueInvoice,
  provisionEmisor,
  registerPayment as registerPaymentApi,
  searchCustomers,
  upsertEmisor,
  upsertTaxProfile,
  uploadEmisorCsd,
  type FetchInvoicesParams,
  type IssueInvoicePayload,
  type UpsertEmisorPayload,
  type UpsertTaxProfilePayload,
} from './api'
import type { BillingCustomerKind } from './types'

export const BILLING_QUERY_KEY = ['superadmin', 'billing'] as const

export function useEmisor() {
  return useQuery({
    queryKey: [...BILLING_QUERY_KEY, 'emisor'],
    queryFn: fetchEmisor,
    staleTime: 60_000,
  })
}

export function useInvoices(params: FetchInvoicesParams = {}) {
  return useQuery({
    queryKey: [...BILLING_QUERY_KEY, 'invoices', params],
    queryFn: () => fetchInvoices(params),
    staleTime: 30_000,
  })
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: [...BILLING_QUERY_KEY, 'invoice', id],
    queryFn: () => fetchInvoice(id as string),
    enabled: Boolean(id),
  })
}

/** Customer search for the "Nueva factura" picker. Enabled only once a term is typed. */
export function useCustomerSearch(type: BillingCustomerKind | undefined, q: string) {
  return useQuery({
    queryKey: [...BILLING_QUERY_KEY, 'customers', type ?? 'all', q],
    queryFn: () => searchCustomers(type, q),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  })
}

export function useEmisorActions() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: [...BILLING_QUERY_KEY, 'emisor'] })

  const save = useMutation({
    mutationFn: (payload: UpsertEmisorPayload) => upsertEmisor(payload),
    onSuccess: () => {
      invalidate()
      toast.success('Datos del emisor guardados')
    },
    onError: (e) => {
      const i = inspectApiError(e, 'guardar el emisor')
      toast.error(i.title, { description: i.description })
    },
  })

  const provision = useMutation({
    mutationFn: (payload: { providerOrgId?: string; liveKey?: string }) => provisionEmisor(payload),
    onSuccess: () => {
      invalidate()
      toast.success('Emisor provisionado en Facturapi')
    },
    onError: (e) => {
      const i = inspectApiError(e, 'provisionar el emisor')
      toast.error(i.title, { description: i.description })
    },
  })

  const uploadCsd = useMutation({
    mutationFn: (payload: { cerBase64: string; keyBase64: string; csdPassword: string }) =>
      uploadEmisorCsd(payload),
    onSuccess: () => {
      invalidate()
      toast.success('CSD cargado correctamente')
    },
    onError: (e) => {
      const i = inspectApiError(e, 'subir el CSD')
      toast.error(i.title, { description: i.description })
    },
  })

  return { save, provision, uploadCsd }
}

export function useTaxProfileActions() {
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: (payload: UpsertTaxProfilePayload) => upsertTaxProfile(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...BILLING_QUERY_KEY, 'customers'] })
      toast.success('Datos fiscales del receptor guardados')
    },
    onError: (e) => {
      const i = inspectApiError(e, 'guardar los datos fiscales')
      toast.error(i.title, { description: i.description })
    },
  })

  const attach = useMutation({
    mutationFn: (v: { profileId: string; constanciaUrl: string }) =>
      attachConstancia(v.profileId, v.constanciaUrl),
    onSuccess: () => toast.success('Constancia adjuntada'),
    onError: (e) => {
      const i = inspectApiError(e, 'adjuntar la constancia')
      toast.error(i.title, { description: i.description })
    },
  })

  return { save, attach }
}

export function useInvoiceActions() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: [...BILLING_QUERY_KEY, 'invoices'] })

  const issue = useMutation({
    mutationFn: (payload: IssueInvoicePayload) => issueInvoice(payload),
    onSuccess: (cfdi) => {
      invalidate()
      toast.success('CFDI timbrado', {
        description: cfdi.uuid ? `Folio fiscal ${cfdi.uuid}` : undefined,
      })
    },
    onError: (e) => {
      const i = inspectApiError(e, 'timbrar la factura')
      toast.error(i.title, { description: i.description })
    },
  })

  const cancel = useMutation({
    mutationFn: (v: { id: string; motivo: '01' | '02' | '03' | '04'; substituteUuid?: string }) =>
      cancelInvoice(v.id, v.motivo, v.substituteUuid),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: [...BILLING_QUERY_KEY, 'invoice'] })
      toast.success('CFDI cancelado')
    },
    onError: (e) => {
      const i = inspectApiError(e, 'cancelar el CFDI')
      toast.error(i.title, { description: i.description })
    },
  })

  const registerPayment = useMutation({
    mutationFn: (v: { id: string; paymentDate: string; formaPago: string }) =>
      registerPaymentApi(v.id, { paymentDate: v.paymentDate, formaPago: v.formaPago }),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: [...BILLING_QUERY_KEY, 'invoice'] })
      toast.success('Complemento de pago timbrado')
    },
    onError: (e) => {
      const i = inspectApiError(e, 'registrar el pago')
      toast.error(i.title, { description: i.description })
    },
  })

  return { issue, cancel, registerPayment }
}
