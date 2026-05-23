/**
 * Types matching the server response from `GET /api/v1/superadmin/activity-log`.
 * Source of truth: avoqado-server/src/services/dashboard/activity-log.service.ts
 * (SuperadminActivityLogEntry + PaginatedSuperadminActivityLogs).
 */

export interface ActivityLogStaff {
  id: string
  firstName: string | null
  lastName: string | null
}

export interface ActivityLogEntry {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  /** jsonb — shape varies per action; render as JSON when shown. */
  data: unknown
  ipAddress: string | null
  /** ISO 8601 UTC string from the server. */
  createdAt: string
  staff: ActivityLogStaff | null
  venueId: string | null
  venueName: string | null
  organizationName: string | null
}

export interface ActivityLogPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ActivityLogResponse {
  logs: ActivityLogEntry[]
  pagination: ActivityLogPagination
}

export interface ActivityLogQueryParams {
  organizationId?: string
  venueId?: string
  staffId?: string
  action?: string
  entity?: string
  search?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

/* ---------- UI-side derived categorisation (no server-side category column). */

export type ActivityCategory = 'auth' | 'kyc' | 'venue' | 'terminal' | 'payment' | 'config'
export type ActivitySeverity = 'info' | 'success' | 'warn' | 'danger'

const KEYS: { match: RegExp; category: ActivityCategory }[] = [
  { match: /^permission|permission/i, category: 'auth' },
  { match: /kyc|verification/i, category: 'kyc' },
  { match: /terminal|app[_-]?update/i, category: 'terminal' },
  { match: /payment|order|settlement/i, category: 'payment' },
  { match: /venue|aggregator|merchant/i, category: 'venue' },
]

export function categorizeEntry(
  entry: Pick<ActivityLogEntry, 'action' | 'entity'>,
): ActivityCategory {
  const haystack = `${entry.action} ${entry.entity ?? ''}`
  for (const { match, category } of KEYS) {
    if (match.test(haystack)) return category
  }
  return 'config'
}

export function severityFor(action: string): ActivitySeverity {
  if (/DENIED|FAIL|ERROR|REJECT/i.test(action)) return 'danger'
  if (/DISABLED|MODIFIED|UPDATE|CHANGE/i.test(action)) return 'warn'
  if (/APPROV|CREAT|ACTIVAT|SUCCESS|GRANTED|ENABLED/i.test(action)) return 'success'
  return 'info'
}

/**
 * Spanish labels para los `action` strings que emite el backend.
 * Cualquier action sin mapeo cae al fallback humanize (camelize del enum).
 * Pega aquí los nuevos cuando aparezcan en el server.
 */
const ACTION_LABELS: Record<string, string> = {
  // Auth / permisos
  PERMISSION_DENIED: 'Permiso denegado',
  PERMISSION_GRANTED: 'Permiso otorgado',
  LOGIN: 'Inicio de sesión',
  LOGIN_FAILED: 'Inicio de sesión fallido',
  LOGOUT: 'Cierre de sesión',
  PASSWORD_RESET: 'Contraseña restablecida',
  USER_PASSWORD_RESET: 'Contraseña de usuario restablecida',
  // Venue
  VENUE_CREATED: 'Venue creado',
  VENUE_UPDATED: 'Venue actualizado',
  VENUE_DELETED: 'Venue eliminado',
  VENUE_SUSPENDED: 'Venue suspendido',
  VENUE_REACTIVATED: 'Venue reactivado',
  // Settings / features
  SETTINGS_UPDATED: 'Configuración actualizada',
  FEATURE_ENABLED_BY_ADMIN: 'Feature habilitado por admin',
  FEATURE_DISABLED_BY_ADMIN: 'Feature deshabilitado por admin',
  MODULE_ENABLED: 'Módulo habilitado',
  MODULE_DISABLED: 'Módulo deshabilitado',
  // Terminal / TPV
  TERMINAL_CREATED: 'Terminal creada',
  TERMINAL_UPDATED: 'Terminal actualizada',
  TERMINAL_DELETED: 'Terminal eliminada',
  TPV_CREATED: 'TPV creado',
  TPV_UPDATED: 'TPV actualizado',
  TPV_DELETED: 'TPV eliminado',
  APP_UPDATE_PUBLISHED: 'Update de app publicado',
  // Inventario
  INVENTORY_DEDUCTED_FOR_SALE: 'Inventario descontado por venta',
  INVENTORY_RESTOCKED: 'Inventario repuesto',
  INVENTORY_ADJUSTED: 'Inventario ajustado',
  // Reservaciones
  RESERVATION_CREATED: 'Reservación creada',
  RESERVATION_UPDATED: 'Reservación actualizada',
  RESERVATION_CANCELLED: 'Reservación cancelada',
  RESERVATION_CONFIRMED: 'Reservación confirmada',
  // Pagos / órdenes
  PAYMENT_LINK_CREATED: 'Liga de pago creada',
  PAYMENT_LINK_UPDATED: 'Liga de pago actualizada',
  PAYMENT_LINK_ARCHIVED: 'Liga de pago archivada',
  PAYMENT_LINK_DELETED: 'Liga de pago eliminada',
  PAYMENT_COMPLETED: 'Pago completado',
  PAYMENT_FAILED: 'Pago fallido',
  PAYMENT_REFUNDED: 'Pago reembolsado',
  ORDER_CREATED: 'Orden creada',
  ORDER_UPDATED: 'Orden actualizada',
  ORDER_CANCELLED: 'Orden cancelada',
  // E-commerce
  ECOMMERCE_MERCHANT_CREATED: 'Merchant e-commerce creado',
  ECOMMERCE_MERCHANT_UPDATED: 'Merchant e-commerce actualizado',
  ECOMMERCE_MERCHANT_DELETED: 'Merchant e-commerce eliminado',
  // KYC
  KYC_APPROVED: 'KYC aprobado',
  KYC_REJECTED: 'KYC rechazado',
  KYC_SUBMITTED: 'KYC enviado',
  KYC_REVIEW_REQUESTED: 'KYC en revisión',
  // Personal
  STAFF_CREATED: 'Personal agregado',
  STAFF_UPDATED: 'Personal actualizado',
  STAFF_DELETED: 'Personal eliminado',
  STAFF_INVITED: 'Personal invitado',
  STAFF_ROLE_CHANGED: 'Rol de personal modificado',
}

const ENTITY_LABELS: Record<string, string> = {
  Venue: 'Venue',
  Terminal: 'Terminal',
  Staff: 'Personal',
  Payment: 'Pago',
  Order: 'Orden',
  PaymentLink: 'Liga de pago',
  EcommerceMerchant: 'Merchant',
  VenueFeature: 'Feature de venue',
  VenueSettings: 'Configuración de venue',
  permission: 'Permiso',
  Reservation: 'Reservación',
  KycReview: 'KYC',
  ActivityLog: 'Registro',
  AppUpdate: 'Update de app',
}

export function humanizeAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]
  // Fallback para actions desconocidas: SCREAMING_SNAKE_CASE → "Sentence case".
  const lower = action.toLowerCase().replace(/_/g, ' ')
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function humanizeEntity(entity: string | null | undefined): string {
  if (!entity) return ''
  return ENTITY_LABELS[entity] ?? entity
}

export function actorDisplayName(staff: ActivityLogStaff | null): string {
  if (!staff) return 'Sistema'
  const parts = [staff.firstName, staff.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : 'Staff sin nombre'
}
