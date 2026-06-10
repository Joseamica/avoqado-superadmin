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
/**
 * Flags de setup-completeness del venue. Calculados server-side en
 * `getAllVenuesForSuperadmin`. Permiten al UI mostrar "¿qué tiene
 * configurado y qué falta?" sin queries adicionales.
 *
 * Cada flag es deliberado:
 * - `hasOwner`: el venue tiene un Staff con rol OWNER o ADMIN.
 * - `hasTerminal`: ≥1 terminal asignada (compatibilidad con TPV).
 * - `hasMerchantAccount`: VenuePaymentConfig con primaryAccountId.
 * - `hasKycDocs`: al menos uno de los docs KYC subidos (INE o RFC doc).
 *   Es indicador de "está en proceso", no de "está completo".
 * - `hasPricing`: ≥1 VenuePricingStructure (comisión por método).
 * - `kycVerified`: `kycStatus === 'VERIFIED'`. Separado del flag de docs
 *   porque tener docs no implica que fueron aprobados.
 *
 * Optional porque venues servidos por endpoints viejos (o legacy data) pueden
 * no traer el bloque. El UI los trata como "desconocido".
 */
export interface VenueCompleteness {
  hasOwner: boolean
  hasTerminal: boolean
  hasMerchantAccount: boolean
  hasKycDocs: boolean
  hasPricing: boolean
  kycVerified: boolean
}

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
  /** Owner = primer Staff con rol OWNER del venue (fallback a ADMIN para legacy data). Puede no existir si el venue está incompleto. */
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
  /** Flags de qué tiene configurado el venue. `undefined` si el backend no lo expone (legacy). */
  completeness?: VenueCompleteness
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

/* --- Plan (monetización por tiers) --- */

/**
 * Espejo de `PlanStateValue` en
 * `avoqado-server/src/services/access/basePlan.service.ts`. Mismo union que
 * `SubscriptionState` del feature subscriptions — se duplica aquí a propósito
 * para que cada feature siga siendo independiente (regla del repo: features no
 * se importan entre sí).
 */
export type PlanStateValue =
  | 'none'
  | 'trial'
  | 'active'
  | 'canceling'
  | 'past_due'
  | 'suspended'
  | 'canceled'

/** Espejo de `PlanTier` (schema.prisma). En UI, GRATIS se muestra como "Free". */
export type PlanTier = 'GRATIS' | 'PRO' | 'PREMIUM' | 'ENTERPRISE'

/**
 * Espejo del `PlanState` que retorna
 * `GET /api/v1/dashboard/venues/:venueId/plan`
 * (`avoqado-server/src/services/dashboard/planState.service.ts`). Sólo los
 * campos que el superadmin usa — el backend manda algunos más
 * (suspendedAt, gracePeriodEndsAt) que hoy no mostramos.
 */
export interface VenuePlanState {
  hasPlan: boolean
  state: PlanStateValue
  planTier: PlanTier | null
  planName: string | null
  interval: 'month' | 'year' | null
  price: { base: number; gross: number; currency: 'MXN' } | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null
  stripeSubscriptionId: string | null
  /**
   * Venue GRANDFATHERED (legacy) — exento de paywalls Y del seat cap de Free.
   * Opera como antes de la monetización. Mapea a `Venue.seatCapExempt` en DB.
   */
  grandfathered: boolean
  retentionOfferEligible: boolean
}

export function humanizePlanTier(tier: PlanTier | null): string {
  // `null` = sin plan base activo = el venue opera en Free.
  if (tier === null) return 'Free'
  switch (tier) {
    case 'GRATIS':
      return 'Free'
    case 'PRO':
      return 'Pro'
    case 'PREMIUM':
      return 'Premium'
    case 'ENTERPRISE':
      return 'Enterprise'
  }
}

export function humanizePlanState(state: PlanStateValue): string {
  switch (state) {
    case 'none':
      return 'Sin plan de pago'
    case 'trial':
      return 'En prueba'
    case 'active':
      return 'Activo'
    case 'canceling':
      return 'Por cancelar'
    case 'past_due':
      return 'Pago vencido'
    case 'suspended':
      return 'Suspendido'
    case 'canceled':
      return 'Cancelado'
  }
}

export const PLAN_STATE_TONE: Record<PlanStateValue, Tone> = {
  none: 'muted',
  trial: 'info',
  active: 'success',
  canceling: 'warn',
  past_due: 'warn',
  suspended: 'danger',
  canceled: 'muted',
}

/**
 * Format de venue.name para uso compacto. Por convención venues tienen
 * nombres "Restaurante Pez Volador" — si el operador busca, usa el slug
 * que es más estable y compatible con URLs.
 */
export function ownerFullName(owner: Venue['owner']): string {
  return [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.email
}

/**
 * Resultado de inspeccionar el owner — distingue entre owner real, fallback
 * "Unknown Owner" del backend (cuando no hay Staff ADMIN en el venue), y
 * email sintético interno (placeholder que el backend genera para owners
 * de terminales, con la forma `*@internal.avoqado.io`).
 *
 * En el UI, sólo el `kind: 'real'` debería mostrarse con nombre + email
 * tappeable. Los otros casos se muestran muteados — el operador NO debe
 * tratar de contactar ese email.
 */
export type OwnerStatus =
  | { kind: 'real'; name: string; email: string }
  | { kind: 'missing'; reason: 'unknown' | 'synthetic-email' }

const SYNTHETIC_EMAIL_DOMAIN = '@internal.avoqado.io'

export function inspectOwner(owner: Venue['owner']): OwnerStatus {
  // El backend retorna este objeto como fallback cuando no encuentra un
  // Staff ADMIN asociado al venue. La triple coincidencia de fields es la
  // signature exacta del fallback en `getAllVenuesForSuperadmin`.
  if (
    owner.firstName === 'Unknown' &&
    owner.lastName === 'Owner' &&
    owner.email === 'unknown@email.com'
  ) {
    return { kind: 'missing', reason: 'unknown' }
  }
  // Emails generados por el backend para venues sin ownership humano.
  // El operador NO debe intentar contactar a este buzón.
  if (owner.email.endsWith(SYNTHETIC_EMAIL_DOMAIN)) {
    return { kind: 'missing', reason: 'synthetic-email' }
  }
  return {
    kind: 'real',
    name: ownerFullName(owner),
    email: owner.email,
  }
}
