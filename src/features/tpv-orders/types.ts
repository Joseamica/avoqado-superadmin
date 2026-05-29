/**
 * Types del feature TPV Orders — espejo del backend
 * (`avoqado-server/prisma/schema.prisma`: `TerminalOrder`, `TerminalOrderItem`).
 *
 * Una `TerminalOrder` es la compra de hardware (TPV PAX / impresoras / KDS)
 * que un venue le hace a Avoqado. Vive en dos planos:
 *  - `paymentStatus` (cómo pagó): AWAITING_PAYMENT → PROOF_UPLOADED → PAID/REJECTED.
 *  - `fulfillmentStatus` (cómo se cumple): NEW → AWAITING_SERIALS → SERIALS_ASSIGNED → SHIPPED → DELIVERED.
 *
 * Los dos son independientes: un pedido puede estar PAID + AWAITING_SERIALS
 * (cobramos, falta asignar serials), o PROOF_UPLOADED + NEW (subió comprobante,
 * pendiente de aprobación).
 */

export type TerminalOrderPaymentMethod = 'CARD_STRIPE' | 'SPEI'

export type TerminalOrderPaymentStatus =
  | 'AWAITING_PAYMENT'
  | 'AWAITING_PROOF'
  | 'PROOF_UPLOADED'
  | 'PAID'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REFUNDED'

export type TerminalOrderFulfillmentStatus =
  | 'NEW'
  | 'AWAITING_SERIALS'
  | 'SERIALS_ASSIGNED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

export interface TerminalOrderItem {
  id: string
  brand: string
  model: string
  productName: string
  quantity: number
  unitPriceCents: number
  /** Prefijo sugerido cuando se generan nombres para cada unidad (ej. "PAX A910 Caja"). */
  namePrefix: string
}

export interface TerminalOrderTerminal {
  id: string
  name: string
  serialNumber: string | null
  activationCode: string | null
  status: string
}

export interface TerminalOrder {
  id: string
  orderNumber: string
  venueId: string
  venue: { id: string; name: string; slug: string }
  contactName: string
  contactEmail: string
  contactPhone: string
  shippingAddress: string
  shippingAddress2: string | null
  shippingCity: string
  shippingState: string
  shippingZip: string
  shippingCountry: string
  paymentMethod: TerminalOrderPaymentMethod
  paymentStatus: TerminalOrderPaymentStatus
  fulfillmentStatus: TerminalOrderFulfillmentStatus
  subtotalCents: number
  taxCents: number
  totalCents: number
  currency: string
  stripeReceiptUrl: string | null
  speiProofUrl: string | null
  speiRejectionReason: string | null
  items: TerminalOrderItem[]
  /** Sólo presente cuando ya se asignaron serials (fulfillmentStatus ≥ SERIALS_ASSIGNED). */
  terminals?: TerminalOrderTerminal[]
  createdAt: string
  updatedAt: string
}

/* --- Payloads de mutations --- */

export interface AssignSerialsPayload {
  items: {
    orderItemId: string
    units: { name: string; serial: string }[]
  }[]
}

/* --- Humanizers --- */

export function humanizePaymentMethod(method: TerminalOrderPaymentMethod): string {
  switch (method) {
    case 'CARD_STRIPE':
      return 'Tarjeta'
    case 'SPEI':
      return 'SPEI'
  }
}

export function humanizePaymentStatus(status: TerminalOrderPaymentStatus): string {
  switch (status) {
    case 'AWAITING_PAYMENT':
      return 'Esperando pago'
    case 'AWAITING_PROOF':
      return 'Esperando comprobante'
    case 'PROOF_UPLOADED':
      return 'Comprobante subido'
    case 'PAID':
      return 'Pagado'
    case 'REJECTED':
      return 'Rechazado'
    case 'EXPIRED':
      return 'Expirado'
    case 'REFUNDED':
      return 'Reembolsado'
  }
}

export function humanizeFulfillmentStatus(status: TerminalOrderFulfillmentStatus): string {
  switch (status) {
    case 'NEW':
      return 'Nuevo'
    case 'AWAITING_SERIALS':
      return 'Asignar serials'
    case 'SERIALS_ASSIGNED':
      return 'Serials asignados'
    case 'SHIPPED':
      return 'Enviado'
    case 'DELIVERED':
      return 'Entregado'
    case 'CANCELLED':
      return 'Cancelado'
  }
}

/* --- Tone maps (judgment, not identity) --- */

type Tone = 'muted' | 'success' | 'warn' | 'danger' | 'info' | 'accent'

export const PAYMENT_STATUS_TONE: Record<TerminalOrderPaymentStatus, Tone> = {
  AWAITING_PAYMENT: 'warn',
  AWAITING_PROOF: 'warn',
  PROOF_UPLOADED: 'info',
  PAID: 'success',
  REJECTED: 'danger',
  EXPIRED: 'muted',
  REFUNDED: 'muted',
}

export const FULFILLMENT_STATUS_TONE: Record<TerminalOrderFulfillmentStatus, Tone> = {
  NEW: 'muted',
  AWAITING_SERIALS: 'warn',
  SERIALS_ASSIGNED: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
}

/** Método de pago es clasificación, no estado → siempre `muted`. */
export const PAYMENT_METHOD_TONE: Record<TerminalOrderPaymentMethod, Tone> = {
  CARD_STRIPE: 'muted',
  SPEI: 'muted',
}

/* --- Helpers --- */

/** Total de unidades en el pedido (suma de quantity de cada item). */
export function totalUnits(order: Pick<TerminalOrder, 'items'>): number {
  return order.items.reduce((acc, i) => acc + i.quantity, 0)
}

/** ¿El pedido está esperando que se asignen serials? */
export function needsSerialsAssignment(
  order: Pick<TerminalOrder, 'paymentStatus' | 'fulfillmentStatus'>,
): boolean {
  return order.paymentStatus === 'PAID' && order.fulfillmentStatus === 'AWAITING_SERIALS'
}

/** ¿Listo para marcar como enviado? */
export function canMarkShipped(order: Pick<TerminalOrder, 'fulfillmentStatus'>): boolean {
  return order.fulfillmentStatus === 'SERIALS_ASSIGNED'
}

/** ¿Listo para marcar como entregado? */
export function canMarkDelivered(order: Pick<TerminalOrder, 'fulfillmentStatus'>): boolean {
  return order.fulfillmentStatus === 'SHIPPED'
}

/**
 * Formatea cents a MXN-style string ($1,234.56 MXN).
 * El backend siempre entrega en centavos integer; UI siempre divide /100.
 */
export function formatMxnCents(cents: number, currency = 'MXN'): string {
  return `$${(cents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}
