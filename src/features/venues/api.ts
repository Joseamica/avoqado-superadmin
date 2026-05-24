/**
 * API client del feature Venues.
 *
 * Apunta al namespace LEGACY del backend: `/api/v1/dashboard/superadmin/venues*`.
 * Razón — los endpoints de venues nunca se migraron al nuevo `/api/v1/superadmin/*`
 * porque `avoqado-web-dashboard` (legacy en producción) sigue consumiéndolos.
 * Crear endpoints paralelos sería duplicar 5+ controladores con cero valor.
 * La regla del CLAUDE.md ("usa /api/v1/superadmin/*") tiene esta excepción
 * documentada: cuando el endpoint vive en otro namespace que ya funciona,
 * lo consumimos donde está. Aditivo siempre.
 */

import { api } from '@/shared/lib/api'
import type { Venue, VenueStatus } from './types'

/**
 * Raw shape exactamente como llega del backend — incluye los campos mock
 * (subscriptionPlan, commissionRate, etc.) que descartamos en `mapVenue`.
 */
interface SuperadminVenueResponse {
  id: string
  name: string
  slug: string
  status: VenueStatus
  // Mocks del backend — los ignoramos:
  // subscriptionPlan, commissionRate, features, billing.*
  monthlyRevenue: number
  totalTransactions: number
  organizationId: string
  organization: {
    id: string
    name: string
    email: string
    phone?: string
  }
  owner: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone?: string
  }
  analytics: {
    monthlyTransactions: number
    monthlyRevenue: number
    averageOrderValue: number
    activeUsers: number
    lastActivityAt: string
  }
  kycStatus?: string | null
  statusChangedAt?: string | null
  suspensionReason?: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Todos los endpoints de `/dashboard/superadmin/*` envuelven la carga en
 * `{ success, data, message }`. No es el patrón que el resto del
 * `avoqado-server` usa (los namespaces más nuevos retornan el array a pelo),
 * pero como el dashboard legacy depende de este shape, no lo tocamos —
 * sólo desenvolvemos aquí.
 */
interface SuperadminEnvelope<T> {
  success: boolean
  data: T
  message?: string
}

function mapVenue(raw: SuperadminVenueResponse): Venue {
  // El backend manda `kycStatus` como string libre (puede ser null o vacío).
  // Lo normalizamos al tipo unión — si llega algo inesperado, lo dejamos null
  // y la UI muestra "Sin KYC" en vez de crashear.
  const kycRaw = raw.kycStatus?.trim() || null
  const kycStatus =
    kycRaw === 'NOT_SUBMITTED' ||
    kycRaw === 'PENDING_REVIEW' ||
    kycRaw === 'IN_REVIEW' ||
    kycRaw === 'VERIFIED' ||
    kycRaw === 'REJECTED'
      ? kycRaw
      : null

  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    status: raw.status,
    kycStatus,
    monthlyRevenue: raw.monthlyRevenue ?? 0,
    monthlyTransactions: raw.analytics?.monthlyTransactions ?? raw.totalTransactions ?? 0,
    averageOrderValue: raw.analytics?.averageOrderValue ?? 0,
    organizationId: raw.organizationId,
    organization: raw.organization,
    owner: raw.owner,
    statusChangedAt: raw.statusChangedAt ?? null,
    suspensionReason: raw.suspensionReason ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export interface FetchVenuesParams {
  /** Si `true`, incluye TRIAL + LIVE_DEMO en la respuesta. Default false. */
  includeDemos?: boolean
}

export async function fetchVenues(params: FetchVenuesParams = {}): Promise<Venue[]> {
  const { data } = await api.get<SuperadminEnvelope<SuperadminVenueResponse[]>>(
    '/dashboard/superadmin/venues',
    {
      params: {
        // El backend acepta `?includeDemos=true|false` (default false en el server).
        includeDemos: params.includeDemos ? 'true' : undefined,
      },
    },
  )
  // Defensa contra responses inesperados — si el envelope viene mal formado
  // (legacy puede haber cambiado), mostramos lista vacía en vez de crashear.
  if (!Array.isArray(data?.data)) return []
  return data.data.map(mapVenue)
}

export async function fetchVenueDetail(venueId: string): Promise<Venue | null> {
  try {
    const { data } = await api.get<SuperadminEnvelope<SuperadminVenueResponse>>(
      `/dashboard/superadmin/venues/${encodeURIComponent(venueId)}`,
    )
    if (!data?.data) return null
    return mapVenue(data.data)
  } catch (error) {
    // El controlador del server devuelve 404 cuando no existe — la query lo
    // diferencia de otros errores y muestra "Venue no encontrado" en lugar
    // del QueryError genérico. Re-lanzamos cualquier otro error.
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return null
    }
    throw error
  }
}
