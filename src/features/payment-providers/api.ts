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
  return mapProvider(data.data)
}

export async function deletePaymentProvider(id: string): Promise<void> {
  await api.delete(`/superadmin/payment-providers/${encodeURIComponent(id)}`)
}
