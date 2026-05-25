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
  completeness?: {
    hasOwner: boolean
    hasTerminal: boolean
    hasMerchantAccount: boolean
    hasKycDocs: boolean
    hasPricing: boolean
    kycVerified: boolean
  }
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
    completeness: raw.completeness,
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

/* ─── Onboarding wizard (POST /api/v1/superadmin/onboarding/venue) ─── */

export interface OrganizationOption {
  id: string
  name: string
  slug: string
  email: string
  /** Cuántos venues ya tiene esta org. Útil para el selector — el operador puede ver de un vistazo si la org está creciendo. */
  venueCount: number
  hasPaymentConfig: boolean
}

export async function fetchOrganizations(): Promise<OrganizationOption[]> {
  // El namespace nuevo `/superadmin/onboarding/*` NO envuelve en `{ success, data, message }`
  // como hace el legacy `/dashboard/superadmin/*`. Acá llega `{ data: [...] }` directo.
  const { data } = await api.get<{
    data: Array<{
      id: string
      name: string
      slug: string
      email: string
      _count: { venues: number }
      hasPaymentConfig: boolean
    }>
  }>('/superadmin/onboarding/organizations')
  return (data.data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    email: o.email,
    venueCount: o._count?.venues ?? 0,
    hasPaymentConfig: o.hasPaymentConfig,
  }))
}

/**
 * Espejo del enum `VenueType` de `avoqado-server/prisma/schema.prisma`.
 * El backend acepta 35+ valores agrupados en 5 categorías (FOOD_SERVICE,
 * RETAIL, SERVICES, HOSPITALITY, ENTERTAINMENT). El wizard del superadmin
 * los agrupa visualmente en 4 grupos para simplificar la elección.
 */
export type VenueType =
  // FOOD_SERVICE
  | 'RESTAURANT'
  | 'BAR'
  | 'CAFE'
  | 'BAKERY'
  | 'FOOD_TRUCK'
  | 'FAST_FOOD'
  | 'CATERING'
  | 'CLOUD_KITCHEN'
  // RETAIL
  | 'RETAIL_STORE'
  | 'JEWELRY'
  | 'CLOTHING'
  | 'ELECTRONICS'
  | 'PHARMACY'
  | 'CONVENIENCE_STORE'
  | 'SUPERMARKET'
  | 'LIQUOR_STORE'
  | 'FURNITURE'
  | 'HARDWARE'
  | 'BOOKSTORE'
  | 'PET_STORE'
  | 'TELECOMUNICACIONES'
  // SERVICES (excl. beauty/spa — los movemos al grupo "Estéticas y spas" en el UI)
  | 'CLINIC'
  | 'VETERINARY'
  | 'FITNESS'
  | 'AUTO_SERVICE'
  | 'LAUNDRY'
  | 'REPAIR_SHOP'
  // Estéticas / spas (subset visual de SERVICES)
  | 'SALON'
  | 'SPA'
  // HOSPITALITY
  | 'HOTEL'
  | 'HOSTEL'
  | 'RESORT'
  // ENTERTAINMENT
  | 'CINEMA'
  | 'ARCADE'
  | 'EVENT_VENUE'
  | 'NIGHTCLUB'
  | 'BOWLING'
  | 'OTHER'
export type EntityType = 'PERSONA_FISICA' | 'PERSONA_MORAL'

export interface PlatformFeature {
  id: string
  code: string
  name: string
  description: string
  category: string
  basePrice?: number
  /** Features `isCore: true` se pre-seleccionan por default al crear venue — son los que casi todo venue necesita (pagos, etc.). */
  isCore: boolean
}

export async function fetchFeatures(): Promise<PlatformFeature[]> {
  // Endpoint legacy — viene envuelto en `{ success, data, message }`.
  const { data } = await api.get<SuperadminEnvelope<PlatformFeature[]>>(
    '/dashboard/superadmin/features',
  )
  if (!Array.isArray(data?.data)) return []
  return data.data
}

export interface CreateVenuePayload {
  organization:
    | { mode: 'existing'; id: string }
    | { mode: 'new'; name: string; email: string; phone: string }
  venue: {
    name: string
    slug?: string
    venueType: VenueType
    entityType?: EntityType
    rfc?: string
    legalName?: string
    timezone?: string
    currency?: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    phone?: string
    email?: string
  }
  team?: {
    owner: { email: string; firstName: string; lastName: string; role?: string }
  }
  features?: string[]
}

interface WizardResponse {
  venueId: string
  organizationId: string
  steps: Array<{ step: string; status: 'success' | 'skipped' | 'error'; message?: string }>
}

export async function createVenueWizard(payload: CreateVenuePayload): Promise<WizardResponse> {
  const { data } = await api.post<{ data: WizardResponse }>('/superadmin/onboarding/venue', payload)
  return data.data
}

/**
 * Aprobar KYC + activar el venue inmediatamente después de crearlo.
 * El backend ya registra esto en ActivityLog (per el controlador `approveVenue`)
 * con `staffId + timestamp + IP`. No le pedimos justificación al operador.
 */
export async function approveVenueAfterCreate(venueId: string): Promise<void> {
  await api.post(`/dashboard/superadmin/venues/${encodeURIComponent(venueId)}/approve`)
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

/* ─── VenuePaymentConfig (F4) — namespace /superadmin/* ─── */

export type PreferredProcessor = 'AUTO' | 'LEGACY' | 'MENTA' | 'CLIP' | 'BANK_DIRECT'

export interface VenuePaymentConfig {
  primaryAccountId: string
  secondaryAccountId: string | null
  tertiaryAccountId: string | null
  preferredProcessor: PreferredProcessor
  routingRules: unknown
}

export interface MerchantAccountOption {
  id: string
  label: string
  providerCode: string
  providerName: string
  environment: string | null
}

export async function fetchVenuePaymentConfig(venueId: string): Promise<VenuePaymentConfig | null> {
  try {
    const { data } = await api.get<{ data: Record<string, unknown> | null }>(
      `/superadmin/venue-pricing/config/${encodeURIComponent(venueId)}`,
    )
    const c = data?.data
    if (!c) return null
    return {
      primaryAccountId: String(c.primaryAccountId ?? ''),
      secondaryAccountId: (c.secondaryAccountId as string | null) ?? null,
      tertiaryAccountId: (c.tertiaryAccountId as string | null) ?? null,
      preferredProcessor: (c.preferredProcessor as PreferredProcessor) ?? 'AUTO',
      routingRules: c.routingRules ?? null,
    }
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null
    throw error
  }
}

export interface SaveVenuePaymentConfigInput {
  primaryAccountId: string
  secondaryAccountId: string | null
  tertiaryAccountId: string | null
  preferredProcessor: PreferredProcessor
  routingRules?: unknown
}

export async function saveVenuePaymentConfig(
  venueId: string,
  exists: boolean,
  input: SaveVenuePaymentConfigInput,
): Promise<void> {
  if (exists) {
    await api.put(`/superadmin/venue-pricing/config/${encodeURIComponent(venueId)}`, input)
  } else {
    await api.post('/superadmin/venue-pricing/config', { venueId, ...input })
  }
}

export async function fetchMerchantAccountOptions(): Promise<MerchantAccountOption[]> {
  const { data } = await api.get<{
    data: Array<{
      id: string
      displayName: string | null
      alias: string | null
      externalMerchantId: string
      blumonEnvironment: string | null
      provider: { code: string; name: string }
    }>
  }>('/superadmin/merchant-accounts', { params: { active: true } })
  if (!Array.isArray(data?.data)) return []
  return data.data.map((m) => ({
    id: m.id,
    label: m.displayName || m.alias || m.externalMerchantId,
    providerCode: m.provider?.code ?? '',
    providerName: m.provider?.name ?? '—',
    environment: m.blumonEnvironment ?? null,
  }))
}

/** Brands de terminales ACTIVOS del venue (hint de compatibilidad). Best-effort. */
export async function fetchVenueTerminalBrands(venueId: string): Promise<string[]> {
  try {
    const { data } = await api.get<{ data: Array<{ brand: string | null; status: string }> }>(
      '/superadmin/terminals',
      { params: { venueId } },
    )
    const rows = Array.isArray(data?.data) ? data.data : []
    return rows
      .filter((t) => t.status === 'ACTIVE' && t.brand)
      .map((t) => (t.brand as string).toUpperCase())
  } catch {
    return []
  }
}
