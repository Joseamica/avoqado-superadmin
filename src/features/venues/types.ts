/**
 * Types y helpers del feature de Venues.
 *
 * Importante — la API de `/api/v1/dashboard/superadmin/venues` retorna varios
 * campos hardcodeados como mock (subscriptionPlan: 'PROFESSIONAL',
 * commissionRate: 15, features: [], billing.*). NO los exponemos al UI hasta
 * que el backend los devuelva reales — sería mentirle al operador. Cuando se
 * conecten, agregamos los campos a `Venue` y a la UI.
 */

/** Estados del ciclo de vida de un Venue. Espejo de `enum VenueStatus` en `avoqado-server/prisma/schema.prisma`. */
export type VenueStatus =
  // Demos (efímeros, se pueden borrar):
  | 'LIVE_DEMO'
  | 'TRIAL'
  // Producción (SAT — no se pueden borrar):
  | 'ONBOARDING'
  | 'PENDING_ACTIVATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'ADMIN_SUSPENDED'
  | 'CLOSED'

/** Estados de KYC. Espejo de `enum VerificationStatus`. */
export type KycStatus = 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED'

/**
 * El subset del response de `/api/v1/dashboard/superadmin/venues` que
 * **realmente vamos a usar** en UI. Los campos mock del backend (mientras
 * no se conecten a fuentes reales) NO entran aquí — eso fuerza que un
 * desarrollador futuro tenga que decidir explícitamente cuando se vuelvan
 * reales.
 */
export interface Venue {
  id: string
  name: string
  slug: string
  status: VenueStatus
  kycStatus: KycStatus | null
  /** Volumen del mes en curso (pagos COMPLETED). Calculado server-side via Prisma groupBy. */
  monthlyRevenue: number
  /** Cuenta de pagos COMPLETED en el mes en curso. */
  monthlyTransactions: number
  /** AOV — derived. Si no hay transacciones, 0. */
  averageOrderValue: number
  organizationId: string
  organization: {
    id: string
    name: string
    email: string
    phone?: string
  }
  /** Owner = primer Staff con rol ADMIN del venue. Puede no existir si el venue está incompleto. */
  owner: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone?: string
  }
  /** Cuándo cambió de estado por última vez (suspendido, reactivado, aprobado, etc.). */
  statusChangedAt: string | null
  /** Razón cuando `status` es SUSPENDED o ADMIN_SUSPENDED. Free-text del operador que lo suspendió. */
  suspensionReason: string | null
  createdAt: string
  updatedAt: string
}

/* --- Categorías derivadas --- */

/** Estados "operacionales" — el venue puede recibir pagos hoy. */
export const OPERATIONAL_STATUSES: VenueStatus[] = ['ACTIVE']

/** Estados "onboarding" — el venue está en proceso de salir a producción. */
export const ONBOARDING_STATUSES: VenueStatus[] = ['ONBOARDING', 'PENDING_ACTIVATION']

/** Estados "suspendidos" — el venue NO recibe pagos pero existe. */
export const SUSPENDED_STATUSES: VenueStatus[] = ['SUSPENDED', 'ADMIN_SUSPENDED']

/** Estados "demo" — ephemerals, no producción. Filtrar fuera por default. */
export const DEMO_STATUSES: VenueStatus[] = ['LIVE_DEMO', 'TRIAL']

/** Estados KYC que requieren acción del superadmin. */
export const KYC_PENDING_STATUSES: KycStatus[] = ['PENDING_REVIEW', 'IN_REVIEW']

export function isDemoVenue(v: Pick<Venue, 'status'>): boolean {
  return DEMO_STATUSES.includes(v.status)
}

export function isOperationalVenue(v: Pick<Venue, 'status'>): boolean {
  return OPERATIONAL_STATUSES.includes(v.status)
}

export function isSuspendedVenue(v: Pick<Venue, 'status'>): boolean {
  return SUSPENDED_STATUSES.includes(v.status)
}

/* --- Humanizers --- */

export function humanizeVenueStatus(status: VenueStatus): string {
  switch (status) {
    case 'LIVE_DEMO':
      return 'Demo público'
    case 'TRIAL':
      return 'Trial'
    case 'ONBOARDING':
      return 'En onboarding'
    case 'PENDING_ACTIVATION':
      return 'Esperando activación'
    case 'ACTIVE':
      return 'Activo'
    case 'SUSPENDED':
      return 'Pausado'
    case 'ADMIN_SUSPENDED':
      return 'Suspendido por Avoqado'
    case 'CLOSED':
      return 'Cerrado'
  }
}

export function humanizeKycStatus(status: KycStatus | null): string {
  if (status === null) return 'Sin KYC'
  switch (status) {
    case 'NOT_SUBMITTED':
      return 'No enviado'
    case 'PENDING_REVIEW':
      return 'En cola'
    case 'IN_REVIEW':
      return 'En revisión'
    case 'VERIFIED':
      return 'Verificado'
    case 'REJECTED':
      return 'Rechazado'
  }
}

/* --- Tone maps (semantic colors) --- */

type Tone = 'muted' | 'success' | 'warn' | 'danger' | 'info' | 'accent'

export const VENUE_STATUS_TONE: Record<VenueStatus, Tone> = {
  LIVE_DEMO: 'info',
  TRIAL: 'accent',
  ONBOARDING: 'warn',
  // `PENDING_ACTIVATION` es más urgente que `ONBOARDING` — significa que el
  // operador YA debería estar revisando. Por eso accent (atrae el ojo) en
  // vez de warn (sólo amarillo).
  PENDING_ACTIVATION: 'accent',
  ACTIVE: 'success',
  SUSPENDED: 'muted',
  ADMIN_SUSPENDED: 'danger',
  CLOSED: 'muted',
}

export const KYC_STATUS_TONE: Record<KycStatus, Tone> = {
  NOT_SUBMITTED: 'muted',
  PENDING_REVIEW: 'warn',
  IN_REVIEW: 'info',
  VERIFIED: 'success',
  REJECTED: 'danger',
}

/**
 * Format de venue.name para uso compacto. Por convención venues tienen
 * nombres "Restaurante Pez Volador" — si el operador busca, usa el slug
 * que es más estable y compatible con URLs.
 */
export function ownerFullName(owner: Venue['owner']): string {
  return [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.email
}
