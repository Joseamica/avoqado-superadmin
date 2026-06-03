/**
 * API client del feature Terminals.
 *
 * Namespaces que usamos:
 *   - Listado / CRUD / activación: `/api/v1/dashboard/superadmin/terminals*`
 *     (newer namespace — response shape `{ data, count }`).
 *   - Comandos genéricos (RESTART, CLEAR_CACHE, etc.): `/api/v1/dashboard/tpv/:id/command`
 *     (sin wrapper, devuelve objeto directo). Es el endpoint que el dashboard
 *     legacy y el mobile dashboard usan — battle-tested.
 */

import { api } from '@/shared/lib/api'
import type { Terminal, TerminalStatus, TerminalType, TpvCommand } from './types'

/* --- Listado y detalle --- */

interface TerminalsListResponse {
  data: TerminalRawResponse[]
  count: number
}

interface TerminalRawResponse {
  id: string
  serialNumber: string | null
  name: string
  type: TerminalType
  brand: string | null
  model: string | null
  status: TerminalStatus
  lastHeartbeat: string | null
  version: string | null
  latestHealthScore: number | null
  latestHealthAt: string | null
  ipAddress: string | null
  isLocked: boolean
  lockedAt: string | null
  lockedReason: string | null
  assignedMerchantIds: string[]
  activationCode: string | null
  activationCodeExpiry: string | null
  activatedAt: string | null
  venueId: string
  venue: { id: string; name: string; slug: string }
  migration?: {
    inProgress: boolean
    commandId: string
    fromVenueId: string
    toVenueId: string
  } | null
  createdAt: string
  updatedAt: string
}

function mapTerminal(raw: TerminalRawResponse): Terminal {
  return {
    id: raw.id,
    serialNumber: raw.serialNumber,
    name: raw.name,
    type: raw.type,
    brand: raw.brand,
    model: raw.model,
    status: raw.status,
    lastHeartbeat: raw.lastHeartbeat,
    version: raw.version,
    latestHealthScore: raw.latestHealthScore,
    latestHealthAt: raw.latestHealthAt,
    ipAddress: raw.ipAddress,
    isLocked: raw.isLocked ?? false,
    lockedAt: raw.lockedAt,
    lockedReason: raw.lockedReason,
    assignedMerchantIds: raw.assignedMerchantIds ?? [],
    activationCode: raw.activationCode,
    activationCodeExpiry: raw.activationCodeExpiry,
    activatedAt: raw.activatedAt,
    venueId: raw.venueId,
    venue: raw.venue,
    migration: raw.migration ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export interface FetchTerminalsParams {
  venueId?: string
  status?: TerminalStatus
  type?: TerminalType
}

export async function fetchTerminals(params: FetchTerminalsParams = {}): Promise<Terminal[]> {
  const { data } = await api.get<TerminalsListResponse>('/dashboard/superadmin/terminals', {
    params,
  })
  if (!Array.isArray(data?.data)) return []
  return data.data.map(mapTerminal)
}

export async function fetchTerminalDetail(terminalId: string): Promise<Terminal | null> {
  try {
    const { data } = await api.get<{ data: TerminalRawResponse }>(
      `/dashboard/superadmin/terminals/${encodeURIComponent(terminalId)}`,
    )
    if (!data?.data) return null
    return mapTerminal(data.data)
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return null
    }
    throw error
  }
}

/* --- Mutations --- */

export interface UpdateTerminalPayload {
  name?: string
  status?: TerminalStatus
  brand?: string
  model?: string
  assignedMerchantIds?: string[]
  /** Solo PATCH del venueId: mueve la terminal a otro venue (limpia merchants asignados automáticamente). */
  venueId?: string
  /** Cuando cambia de brand y los merchants asignados son incompatibles, `true` los desasigna; `false` (default) devuelve warning. */
  forceUnassign?: boolean
}

export async function updateTerminal(
  terminalId: string,
  payload: UpdateTerminalPayload,
): Promise<Terminal> {
  const { data } = await api.patch<{ data: TerminalRawResponse }>(
    `/dashboard/superadmin/terminals/${encodeURIComponent(terminalId)}`,
    payload,
  )
  if (!data?.data) throw new Error('Server returned empty response for updateTerminal')
  return mapTerminal(data.data)
}

/**
 * Genera un código de activación 6-char alfanumérico para la terminal.
 * El terminal lo usa para activarse desde la app mobile (similar al
 * código de Square POS). Caduca a los 7 días.
 */
export async function generateActivationCode(
  terminalId: string,
): Promise<{ code: string; expiresAt: string }> {
  const { data } = await api.post<{ data: { code: string; expiresAt: string } }>(
    `/dashboard/superadmin/terminals/${encodeURIComponent(terminalId)}/generate-activation-code`,
  )
  if (!data?.data) throw new Error('Server returned empty response for generateActivationCode')
  return data.data
}

/**
 * Activación remota: el superadmin "preinstala" una terminal previamente
 * registrada SIN que el operador en sitio tenga que ingresar código. Útil
 * para roll-outs masivos donde el técnico ya hizo la instalación física
 * pero todavía no se hizo el bootstrap.
 */
export async function remoteActivate(terminalId: string): Promise<void> {
  await api.post(
    `/dashboard/superadmin/terminals/${encodeURIComponent(terminalId)}/remote-activate`,
  )
}

/* --- Migración de terminal a otro venue --- */

/**
 * Resultado del preflight de migración. El backend valida si la terminal
 * puede moverse al venue destino sin romper nada: `blockers` (no se puede
 * proceder hasta resolverlos) y `warnings` (avisos que el operador debe leer
 * pero no impiden migrar).
 */
export interface MigratePreflightResult {
  canProceed: boolean
  blockers: Array<{ code: string; message: string }>
  warnings: Array<{ code: string; message: string }>
  fromVenueId: string
  toVenueId: string
}

/**
 * Valida la migración de una terminal al venue `toVenueId`. NO ejecuta nada
 * — sólo reporta bloqueadores y advertencias para que el operador decida.
 */
export async function migratePreflight(
  terminalId: string,
  toVenueId: string,
): Promise<MigratePreflightResult> {
  const { data } = await api.post<{ data: MigratePreflightResult }>(
    `/dashboard/superadmin/terminals/${encodeURIComponent(terminalId)}/migrate-preflight`,
    { toVenueId },
  )
  if (!data?.data) throw new Error('Server returned empty response for migratePreflight')
  return data.data
}

export interface MigrateExecuteResult {
  commandId: string
  fromVenueId: string
  toVenueId: string
  startedAt: string
}

/**
 * Arranca la migración: re-parenta la terminal al venue destino y dispara el
 * factory-reset remoto. Devuelve el `commandId` con el que se hace polling del
 * estado. `assignedMerchantIds` opcional — los merchants a asignar en el
 * destino (si se omite, la terminal hereda el merchant primario del venue).
 */
export async function migrateExecute(
  terminalId: string,
  toVenueId: string,
  assignedMerchantIds?: string[],
): Promise<MigrateExecuteResult> {
  const { data } = await api.post<{ data: MigrateExecuteResult }>(
    `/dashboard/superadmin/terminals/${encodeURIComponent(terminalId)}/migrate-execute`,
    { toVenueId, assignedMerchantIds },
  )
  if (!data?.data) throw new Error('Server returned empty response for migrateExecute')
  return data.data
}

/**
 * Estado en vivo de una migración. El polling se detiene cuando `confirmed`
 * es `true` (la terminal reapareció online bajo el venue destino).
 */
export interface MigrateStatusResult {
  commandStatus: string
  commandDelivered: boolean
  reboundAfterWipe: boolean
  currentlyOnline: boolean
  onlineUnderNewVenue: boolean
  confirmed: boolean
  elapsedMs: number
}

export async function migrateStatus(
  terminalId: string,
  commandId: string,
): Promise<MigrateStatusResult> {
  const { data } = await api.get<{ data: MigrateStatusResult }>(
    `/dashboard/superadmin/terminals/${encodeURIComponent(terminalId)}/migrate-status`,
    { params: { commandId } },
  )
  if (!data?.data) throw new Error('Server returned empty response for migrateStatus')
  return data.data
}

export interface MigrateCancelResult {
  cancelled: boolean
  restoredVenueId: string
}

/**
 * Cancela una migración en curso y restaura la terminal a su venue original.
 * Sólo es posible mientras la terminal aún no completó el rebote post-wipe;
 * si ya es tarde, el backend responde error (lo surface el caller via toast).
 */
export async function migrateCancel(terminalId: string): Promise<MigrateCancelResult> {
  const { data } = await api.post<{ data: MigrateCancelResult }>(
    `/dashboard/superadmin/terminals/${encodeURIComponent(terminalId)}/migrate-cancel`,
  )
  if (!data?.data) throw new Error('Server returned empty response for migrateCancel')
  return data.data
}

/**
 * Envía un comando genérico a la terminal (RESTART, CLEAR_CACHE, FACTORY_RESET, etc.).
 * El backend lo encola y lo despacha vía Socket.IO al terminal cuando esté online.
 * Algunos comandos requieren payload (ej. INSTALL_VERSION lleva `{ version: "1.42.0" }`).
 */
export async function sendCommand(
  terminalId: string,
  command: TpvCommand,
  payload?: Record<string, unknown>,
): Promise<{ commandId: string; status: string }> {
  const { data } = await api.post<{ data: { commandId: string; status: string } }>(
    `/dashboard/tpv/${encodeURIComponent(terminalId)}/command`,
    { command, payload },
  )
  return data?.data ?? { commandId: '', status: 'queued' }
}

export async function deleteTerminal(terminalId: string): Promise<void> {
  await api.delete(`/dashboard/superadmin/terminals/${encodeURIComponent(terminalId)}`)
}

/* --- Alta de terminal --- */

export interface CreateTerminalPayload {
  venueId: string
  /** Serial físico — el zod del backend lo marca required. Para terminals pre-activadas se inventa un placeholder y se reemplaza cuando la terminal envía su heartbeat. */
  serialNumber: string
  name: string
  type: TerminalType
  brand?: string
  model?: string
  assignedMerchantIds?: string[]
  /** Si `true`, después del create dispara `generate-activation-code` y devuelve el código en la response. */
  generateActivationCode?: boolean
  configOverrides?: Record<string, unknown>
}

interface CreateTerminalResponse {
  data: TerminalRawResponse & {
    activationCode?: string
    activationCodeExpiry?: string
  }
}

export async function createTerminal(
  payload: CreateTerminalPayload,
): Promise<Terminal & { activationCode: string | null; activationCodeExpiry: string | null }> {
  const { data } = await api.post<CreateTerminalResponse>(
    '/dashboard/superadmin/terminals',
    payload,
  )
  if (!data?.data) throw new Error('Server returned empty response for createTerminal')
  return {
    ...mapTerminal(data.data),
    activationCode: data.data.activationCode ?? null,
    activationCodeExpiry: data.data.activationCodeExpiry ?? null,
  }
}

/* --- Merchant accounts (para selector) --- */

export interface MerchantAccountOption {
  id: string
  displayName: string
  alias: string | null
  externalMerchantId: string | null
  providerName: string
}

interface MerchantAccountsResponse {
  data: Array<{
    id: string
    displayName: string
    alias: string | null
    externalMerchantId: string | null
    provider: { name: string } | null
  }>
}

/* --- TPV Settings (PUT /dashboard/tpv/:tpvId/settings) --- */

/**
 * Settings runtime de la terminal — espejo del `TpvSettings` interface en
 * `avoqado-server/src/services/dashboard/tpv.dashboard.service.ts`. NO es
 * el mismo objeto que `Terminal` (que tiene identity + status + hardware).
 * Estas son las preferencias operativas que el operador ajusta para que
 * la TPV se comporte como quiere el venue.
 *
 * Algunos campos son opcionales porque son experimentales o de feature flags.
 */
export interface TpvSettings {
  // Pantallas de payment UX
  showReviewScreen: boolean
  showTipScreen: boolean
  showReceiptScreen: boolean
  defaultTipPercentage: number | null
  tipSuggestions: number[]
  // Login / acceso
  requirePinLogin: boolean
  requireClockInToLogin: boolean
  requireClockInPhoto: boolean
  requireClockOutPhoto: boolean
  // Sale verification (retail / telcos)
  showVerificationScreen: boolean
  requireVerificationPhoto: boolean
  requireVerificationBarcode: boolean
  // Kiosk mode
  kioskModeEnabled: boolean
  kioskDefaultMerchantId: string | null
  // Módulos del home screen — qué botones ve el staff al entrar
  showQuickPayment: boolean
  showOrderManagement: boolean
  showReports: boolean
  showPayments: boolean
  showSupport: boolean
  showGoals: boolean
  showMessages: boolean
  showTrainings: boolean
  showCheckout: boolean
  // Pagos habilitados (qué métodos puede cobrar la terminal)
  enableCashPayments?: boolean
  enableCardPayments?: boolean
  enableBarcodeScanner?: boolean
  enableSerializedInventory?: boolean
  // Evidence rules (PlayTelecom — boolean toggles)
  requireDepositPhoto?: boolean
  requireFacadePhoto?: boolean
  attendanceTracking?: boolean
  // Cellular failover (experimental)
  cellularFailoverMode: 'OFF' | 'MANUAL_TOGGLE' | 'AUTO_SHADOW' | 'AUTO_ENFORCED'
  cellularFailoverBadReadingsThreshold: number
  cellularFailoverCooldownSeconds: number
  cellularFailoverMinCellHoldSeconds: number
}

export async function fetchTpvSettings(terminalId: string): Promise<TpvSettings> {
  const { data } = await api.get<{ data: TpvSettings } | TpvSettings>(
    `/dashboard/tpv/${encodeURIComponent(terminalId)}/settings`,
  )
  // El endpoint a veces devuelve `{ data: settings }` y a veces el objeto
  // directo dependiendo de la versión del controller — soportamos ambos.
  const obj = (data as { data?: TpvSettings })?.data ?? (data as TpvSettings)
  return obj
}

export async function updateTpvSettings(
  terminalId: string,
  patch: Partial<TpvSettings>,
): Promise<TpvSettings> {
  const { data } = await api.put<{ data: TpvSettings } | TpvSettings>(
    `/dashboard/tpv/${encodeURIComponent(terminalId)}/settings`,
    patch,
  )
  const obj = (data as { data?: TpvSettings })?.data ?? (data as TpvSettings)
  return obj
}

export async function fetchMerchantAccounts(): Promise<MerchantAccountOption[]> {
  const { data } = await api.get<MerchantAccountsResponse>(
    '/superadmin/onboarding/merchant-accounts',
  )
  if (!Array.isArray(data?.data)) return []
  return data.data.map((a) => ({
    id: a.id,
    displayName: a.displayName,
    alias: a.alias,
    externalMerchantId: a.externalMerchantId,
    providerName: a.provider?.name ?? '—',
  }))
}

/* --- App versions disponibles --- */

/**
 * Una versión publicada del AvoqadoPOS — alimenta el dropdown de
 * `INSTALL_VERSION`. El backend solo retorna versiones `isActive=true` por
 * default; las retiradas no aparecen.
 */
export interface AppVersion {
  id: string
  versionName: string
  versionCode: number
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT'
  releaseNotes: string | null
  updateMode: 'NONE' | 'BANNER' | 'FORCE'
  /** Cuándo se subió a Firebase Storage. */
  createdAt: string
  isActive: boolean
}

interface AppUpdatesResponse {
  success: boolean
  data: Array<{
    id: string
    versionName: string
    versionCode: number
    environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT'
    releaseNotes: string | null
    updateMode: 'NONE' | 'BANNER' | 'FORCE'
    createdAt: string
    isActive: boolean
  }>
}

export async function fetchAppVersions(): Promise<AppVersion[]> {
  const { data } = await api.get<AppUpdatesResponse>('/dashboard/superadmin/app-updates')
  if (!Array.isArray(data?.data)) return []
  return data.data.map((u) => ({
    id: u.id,
    versionName: u.versionName,
    versionCode: u.versionCode,
    environment: u.environment,
    releaseNotes: u.releaseNotes,
    updateMode: u.updateMode,
    createdAt: u.createdAt,
    isActive: u.isActive,
  }))
}
