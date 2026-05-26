/**
 * API client del feature Payment Providers.
 *
 * Endpoints: `/api/v1/superadmin/payment-providers/*`. Response wrapper
 * canonical del namespace nuevo: `{ success, data, meta? }`.
 */

import { api } from '@/shared/lib/api'
import type { PaymentProvider, ProviderType } from './types'

interface PaymentProviderRaw {
  id: string
  code: string
  name: string
  type: ProviderType
  countryCode: string[]
  active: boolean
  configSchema: Record<string, unknown> | null
  _count?: {
    merchants?: number
    costStructures?: number
  }
  createdAt: string
  updatedAt: string
}

function mapProvider(raw: PaymentProviderRaw): PaymentProvider {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    type: raw.type,
    countryCode: raw.countryCode ?? [],
    active: raw.active,
    configSchema: raw.configSchema,
    merchantsCount: raw._count?.merchants,
    costStructuresCount: raw._count?.costStructures,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export interface FetchProvidersParams {
  type?: ProviderType
  countryCode?: string
  active?: boolean
}

export async function fetchPaymentProviders(
  params: FetchProvidersParams = {},
): Promise<PaymentProvider[]> {
  const { data } = await api.get<{ success: boolean; data: PaymentProviderRaw[] }>(
    '/superadmin/payment-providers',
    {
      params: {
        type: params.type,
        countryCode: params.countryCode,
        active: params.active !== undefined ? String(params.active) : undefined,
      },
    },
  )
  if (!Array.isArray(data?.data)) return []
  return data.data.map(mapProvider)
}

export async function fetchPaymentProvider(id: string): Promise<PaymentProvider | null> {
  try {
    const { data } = await api.get<{ success: boolean; data: PaymentProviderRaw }>(
      `/superadmin/payment-providers/${encodeURIComponent(id)}`,
    )
    if (!data?.data) return null
    return mapProvider(data.data)
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return null
    }
    throw error
  }
}

export interface CreatePaymentProviderPayload {
  code: string
  name: string
  type: ProviderType
  countryCode: string[]
  configSchema?: Record<string, unknown> | null
  active?: boolean
}

export async function createPaymentProvider(
  payload: CreatePaymentProviderPayload,
): Promise<PaymentProvider> {
  const { data } = await api.post<{ success: boolean; data: PaymentProviderRaw }>(
    '/superadmin/payment-providers',
    payload,
  )
  if (!data?.data) throw new Error('Server returned empty response for createPaymentProvider')
  return mapProvider(data.data)
}

export interface UpdatePaymentProviderPayload {
  name?: string
  type?: ProviderType
  countryCode?: string[]
  configSchema?: Record<string, unknown> | null
  active?: boolean
}

export async function updatePaymentProvider(
  id: string,
  payload: UpdatePaymentProviderPayload,
): Promise<PaymentProvider> {
  const { data } = await api.put<{ success: boolean; data: PaymentProviderRaw }>(
    `/superadmin/payment-providers/${encodeURIComponent(id)}`,
    payload,
  )
  if (!data?.data) throw new Error('Server returned empty response for updatePaymentProvider')
  return mapProvider(data.data)
}

/**
 * Toggle activo/inactivo del provider — endpoint dedicado más ligero que un PUT
 * completo. Útil para la columna de toggle de la tabla.
 */
export async function togglePaymentProvider(id: string): Promise<PaymentProvider> {
  const { data } = await api.patch<{ success: boolean; data: PaymentProviderRaw }>(
    `/superadmin/payment-providers/${encodeURIComponent(id)}/toggle`,
  )
  if (!data?.data) throw new Error('Server returned empty response for togglePaymentProvider')
  return mapProvider(data.data)
}

export async function deletePaymentProvider(id: string): Promise<void> {
  await api.delete(`/superadmin/payment-providers/${encodeURIComponent(id)}`)
}

/* --- Borrado guiado (Paso 1: providers) --- */

export interface ProviderBlockers {
  code: string
  name: string
  merchants: { id: string; label: string }[]
  ecommerceMerchants: { id: string; label: string; removable: boolean; reason?: string }[]
  webhooks: number
  eventLogs: number
  costStructures: number
  canDelete: boolean
}

/** Lista qué impide borrar (de verdad) un provider. */
export async function fetchProviderBlockers(id: string): Promise<ProviderBlockers> {
  const { data } = await api.get<{ success: boolean; data: ProviderBlockers }>(
    `/superadmin/payment-providers/${encodeURIComponent(id)}/blockers`,
  )
  if (!data?.data) throw new Error('Server returned empty response for fetchProviderBlockers')
  return data.data
}

/** Borrado REAL del provider — sólo procede si está 100% limpio (si no, el server responde 400). */
export async function forceDeletePaymentProvider(id: string): Promise<void> {
  await api.delete(`/superadmin/payment-providers/${encodeURIComponent(id)}`, {
    params: { force: 'true' },
  })
}

/** Quita un merchant account. Puede fallar si tiene historial — el server explica qué falta. */
export async function deleteMerchantAccount(id: string): Promise<void> {
  await api.delete(`/superadmin/merchant-accounts/${encodeURIComponent(id)}`)
}

/** Quita un canal e-commerce. Sólo si no tiene historial (el server responde 400 si no). */
export async function deleteEcommerceMerchant(id: string): Promise<void> {
  await api.delete(`/dashboard/superadmin/ecommerce-merchants/${encodeURIComponent(id)}`)
}

/* --- Borrado guiado (Paso 2: merchants a fondo) --- */

export interface MerchantBlockers {
  displayName: string
  payments: number
  transactionCosts: number
  costStructures: { id: string }[]
  venueConfigs: { venueId: string; venueName: string; slot: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' }[]
  terminals: { id: string; name: string; serialNumber: string | null }[]
  canDelete: boolean
}

/** Lista qué impide borrar un merchant (terminales, slots, costos + historial). */
export async function fetchMerchantBlockers(merchantId: string): Promise<MerchantBlockers> {
  const { data } = await api.get<{ success: boolean; data: MerchantBlockers }>(
    `/superadmin/merchant-accounts/${encodeURIComponent(merchantId)}/blockers`,
  )
  if (!data?.data) throw new Error('Server returned empty response for fetchMerchantBlockers')
  return data.data
}

/** Desasigna una terminal del merchant (deja de procesarlo). */
export async function detachTerminalFromMerchant(
  merchantId: string,
  terminalId: string,
): Promise<void> {
  await api.put(
    `/superadmin/merchant-accounts/${encodeURIComponent(merchantId)}/terminals/${encodeURIComponent(terminalId)}`,
    { serves: false },
  )
}

/** Quita una estructura de costo del proveedor (no removible si la referencian transacciones). */
export async function deleteCostStructure(id: string): Promise<void> {
  await api.delete(`/superadmin/cost-structures/${encodeURIComponent(id)}`)
}
