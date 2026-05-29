/**
 * API client del feature TPV Orders.
 *
 * Namespace: SOLO `/superadmin/tpv-orders*` y `/public/tpv-orders/*` (magic links).
 * NUNCA `/dashboard/superadmin/*` — endpoint nuevo, va directo al namespace nuevo.
 *
 * Endpoints autenticados (cookie HTTP-only):
 *   GET  /superadmin/tpv-orders                       — listado
 *   GET  /superadmin/tpv-orders/:id                   — detalle
 *   POST /superadmin/tpv-orders/:id/assign-serials    — asignar serials (sales)
 *   POST /superadmin/tpv-orders/:id/mark-shipped      — marcar enviado
 *   POST /superadmin/tpv-orders/:id/mark-delivered    — marcar entregado
 *
 * Endpoints públicos (magic link, token JWT en query string, sin cookie):
 *   GET  /public/tpv-orders/:id/approve                 — auto-aprobar SPEI
 *   GET  /public/tpv-orders/:id/approve/check           — validar token aprob/rechazo
 *   POST /public/tpv-orders/:id/reject                  — rechazar SPEI
 *   GET  /public/tpv-orders/:id/assign-serials/check    — validar token + traer items
 *   POST /public/tpv-orders/:id/assign-serials          — asignar serials sin login
 *
 * Todas las respuestas vienen como `{ success: true, data: ... }`.
 */
import { api } from '@/shared/lib/api'
import type { AssignSerialsPayload, TerminalOrder } from './types'

interface ListResponse {
  success: true
  data: TerminalOrder[]
}

interface DetailResponse {
  success: true
  data: TerminalOrder
}

interface ActionResponse {
  success: true
  data: { orderId: string; orderNumber: string }
}

/* ----- Autenticados (superadmin) ----- */

export async function listTpvOrders(): Promise<TerminalOrder[]> {
  const { data } = await api.get<ListResponse>('/superadmin/tpv-orders')
  return Array.isArray(data?.data) ? data.data : []
}

export async function getTpvOrder(id: string): Promise<TerminalOrder> {
  const { data } = await api.get<DetailResponse>(`/superadmin/tpv-orders/${encodeURIComponent(id)}`)
  return data.data
}

export async function assignSerialsAuthenticated(
  id: string,
  payload: AssignSerialsPayload,
): Promise<TerminalOrder> {
  const { data } = await api.post<DetailResponse>(
    `/superadmin/tpv-orders/${encodeURIComponent(id)}/assign-serials`,
    payload,
  )
  return data.data
}

export async function markShipped(
  id: string,
  trackingNumber: string,
  carrier: string,
): Promise<TerminalOrder> {
  const { data } = await api.post<DetailResponse>(
    `/superadmin/tpv-orders/${encodeURIComponent(id)}/mark-shipped`,
    { trackingNumber, carrier },
  )
  return data.data
}

export async function markDelivered(id: string): Promise<TerminalOrder> {
  const { data } = await api.post<DetailResponse>(
    `/superadmin/tpv-orders/${encodeURIComponent(id)}/mark-delivered`,
  )
  return data.data
}

/* ----- Magic-link (público, token-based) -----
 *
 * IMPORTANTE: estos endpoints viven detrás del CORS público (`origin: '*'`,
 * `credentials: false`). Si mandamos `withCredentials: true` (default del shared
 * `api`), el browser rechaza la respuesta porque wildcard origin + credentials
 * son incompatibles → axios reporta "Network Error" aunque el servidor procesó
 * el request. Override per-request a `withCredentials: false`.
 */
const PUBLIC_CONFIG = { withCredentials: false } as const

/**
 * Some calls return success even when the order has already advanced
 * (idempotent re-fire from React StrictMode in dev, double-click, etc.).
 * Wrap the call so that a 400 with "already in <state>" is treated as success.
 */
function isAlreadyDoneError(err: unknown, doneStates: string[]): boolean {
  if (typeof err !== 'object' || err === null) return false
  const anyErr = err as { response?: { data?: { error?: string }; status?: number } }
  const msg = anyErr.response?.data?.error ?? ''
  return (
    anyErr.response?.status === 400 &&
    doneStates.some((s) => msg.toLowerCase().includes(`current: ${s.toLowerCase()}`))
  )
}

export async function publicApprove(orderId: string, token: string) {
  try {
    const { data } = await api.get<ActionResponse>(
      `/public/tpv-orders/${encodeURIComponent(orderId)}/approve?token=${encodeURIComponent(token)}`,
      PUBLIC_CONFIG,
    )
    return data.data
  } catch (err) {
    // If a prior call already approved (PAID), treat re-fire as success.
    if (isAlreadyDoneError(err, ['PAID'])) {
      return { orderId, orderNumber: '' }
    }
    throw err
  }
}

export async function publicApproveCheck(orderId: string, token: string) {
  const { data } = await api.get<ActionResponse>(
    `/public/tpv-orders/${encodeURIComponent(orderId)}/approve/check?token=${encodeURIComponent(token)}`,
    PUBLIC_CONFIG,
  )
  return data.data
}

export async function publicReject(orderId: string, token: string, reason: string) {
  try {
    const { data } = await api.post<ActionResponse>(
      `/public/tpv-orders/${encodeURIComponent(orderId)}/reject?token=${encodeURIComponent(token)}`,
      { reason },
      PUBLIC_CONFIG,
    )
    return data.data
  } catch (err) {
    if (isAlreadyDoneError(err, ['REJECTED'])) {
      return { orderId, orderNumber: '' }
    }
    throw err
  }
}

export async function publicAssignSerialsCheck(
  orderId: string,
  token: string,
): Promise<TerminalOrder> {
  const { data } = await api.get<DetailResponse>(
    `/public/tpv-orders/${encodeURIComponent(orderId)}/assign-serials/check?token=${encodeURIComponent(token)}`,
    PUBLIC_CONFIG,
  )
  return data.data
}

export async function publicAssignSerials(
  orderId: string,
  token: string,
  payload: AssignSerialsPayload,
) {
  try {
    const { data } = await api.post<ActionResponse>(
      `/public/tpv-orders/${encodeURIComponent(orderId)}/assign-serials?token=${encodeURIComponent(token)}`,
      payload,
      PUBLIC_CONFIG,
    )
    return data.data
  } catch (err) {
    if (isAlreadyDoneError(err, ['SERIALS_ASSIGNED', 'SHIPPED', 'DELIVERED'])) {
      return { orderId, orderNumber: '' }
    }
    throw err
  }
}
