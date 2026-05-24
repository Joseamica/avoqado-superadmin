/**
 * Types y helpers del feature de Terminals (TPVs / impresoras / KDS).
 *
 * Mirror del backend (`avoqado-server/prisma/schema.prisma`):
 *   - TerminalType: TPV_ANDROID, TPV_IOS, PRINTER_RECEIPT, PRINTER_KITCHEN, KDS
 *   - TerminalStatus: PENDING_ACTIVATION, ACTIVE, INACTIVE, MAINTENANCE, RETIRED
 *   - TpvCommandType: 24 comandos agrupados en device-state / lifecycle /
 *     data-management / config / automation
 */

export type TerminalType = 'TPV_ANDROID' | 'TPV_IOS' | 'PRINTER_RECEIPT' | 'PRINTER_KITCHEN' | 'KDS'

export type TerminalStatus =
  | 'PENDING_ACTIVATION'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'MAINTENANCE'
  | 'RETIRED'

/**
 * Todos los TpvCommand del backend, agrupados conceptualmente. Sólo
 * exponemos al UI los que tienen sentido operativo en el superadmin —
 * algunos como GEOFENCE_TRIGGER son automation interna que no se invoca
 * a mano.
 */
export type TpvCommand =
  // Device state
  | 'LOCK'
  | 'UNLOCK'
  | 'MAINTENANCE_MODE'
  | 'EXIT_MAINTENANCE'
  | 'REACTIVATE'
  | 'REMOTE_ACTIVATE'
  // App lifecycle
  | 'RESTART'
  | 'SHUTDOWN'
  | 'CLEAR_CACHE'
  | 'FORCE_UPDATE'
  | 'REQUEST_UPDATE'
  | 'INSTALL_VERSION'
  // Data management
  | 'SYNC_DATA'
  | 'FACTORY_RESET'
  | 'EXPORT_LOGS'
  // Configuration
  | 'UPDATE_CONFIG'
  | 'REFRESH_MENU'
  | 'UPDATE_MERCHANT'

export interface Terminal {
  id: string
  /** Hardware serial — `null` antes de la activación física. */
  serialNumber: string | null
  /** Nombre human-readable que le puso el operador. */
  name: string
  type: TerminalType
  /** Hardware brand: PAX, Ingenico, Verifone, NEXGO. */
  brand: string | null
  model: string | null
  status: TerminalStatus
  /** Última vez que la terminal envió heartbeat. `null` si nunca. */
  lastHeartbeat: string | null
  /** Versión de AvoqadoPOS instalada. `null` si no activada. */
  version: string | null
  /** Score 0-100 — calculado server-side desde los últimos health metrics. */
  latestHealthScore: number | null
  latestHealthAt: string | null
  /** IPs desde donde ha conectado. */
  ipAddress: string | null
  /** True si está locked (independiente del status). */
  isLocked: boolean
  lockedAt: string | null
  lockedReason: string | null
  /** Códigos de merchant accounts asignados a este terminal. */
  assignedMerchantIds: string[]
  /** Código de activación pendiente (6 chars). `null` si ya está activada o nunca se generó. */
  activationCode: string | null
  activationCodeExpiry: string | null
  /** Primera vez que la terminal activó con su serial. `null` si nunca. */
  activatedAt: string | null
  /** Venue al que pertenece. */
  venueId: string
  venue: {
    id: string
    name: string
    slug: string
  }
  createdAt: string
  updatedAt: string
}

/* --- Estado derivado --- */

/**
 * "Online" = mandó heartbeat en los últimos 5 minutos. El TPV manda cada
 * 60 segundos, así que 5 min de tolerancia cubre saltos de red. Es una
 * heurística client-side; el backend tiene su propia `tpvHealthService`
 * con lógica más sofisticada pero no la expone en este endpoint.
 */
const ONLINE_THRESHOLD_MS = 5 * 60_000

export function isTerminalOnline(t: Pick<Terminal, 'lastHeartbeat'>): boolean {
  if (!t.lastHeartbeat) return false
  return Date.now() - new Date(t.lastHeartbeat).getTime() < ONLINE_THRESHOLD_MS
}

/** "Activable" = puede recibir un comando de activación remota (status correcto + sin activar). */
export function canBeActivated(t: Pick<Terminal, 'status' | 'activatedAt'>): boolean {
  return t.status === 'PENDING_ACTIVATION' && !t.activatedAt
}

/* --- Humanizers --- */

export function humanizeTerminalType(type: TerminalType): string {
  switch (type) {
    case 'TPV_ANDROID':
      return 'TPV Android'
    case 'TPV_IOS':
      return 'TPV iOS'
    case 'PRINTER_RECEIPT':
      return 'Impresora ticket'
    case 'PRINTER_KITCHEN':
      return 'Impresora cocina'
    case 'KDS':
      return 'KDS'
  }
}

export function humanizeTerminalStatus(status: TerminalStatus): string {
  switch (status) {
    case 'PENDING_ACTIVATION':
      return 'Sin activar'
    case 'ACTIVE':
      return 'Activa'
    case 'INACTIVE':
      return 'Inactiva'
    case 'MAINTENANCE':
      return 'En mantenimiento'
    case 'RETIRED':
      return 'Retirada'
  }
}

export function humanizeCommand(cmd: TpvCommand): string {
  switch (cmd) {
    case 'RESTART':
      return 'Reiniciar app'
    case 'SHUTDOWN':
      return 'Apagar'
    case 'CLEAR_CACHE':
      return 'Limpiar caché'
    case 'FACTORY_RESET':
      return 'Restablecer de fábrica'
    case 'LOCK':
      return 'Bloquear'
    case 'UNLOCK':
      return 'Desbloquear'
    case 'MAINTENANCE_MODE':
      return 'Entrar en mantenimiento'
    case 'EXIT_MAINTENANCE':
      return 'Salir de mantenimiento'
    case 'REACTIVATE':
      return 'Reactivar'
    case 'REMOTE_ACTIVATE':
      return 'Activar remotamente'
    case 'INSTALL_VERSION':
      return 'Instalar versión específica'
    case 'FORCE_UPDATE':
      return 'Forzar actualización'
    case 'REQUEST_UPDATE':
      return 'Pedir actualización'
    case 'SYNC_DATA':
      return 'Sincronizar datos'
    case 'EXPORT_LOGS':
      return 'Exportar logs'
    case 'UPDATE_CONFIG':
      return 'Actualizar configuración'
    case 'REFRESH_MENU':
      return 'Refrescar menú'
    case 'UPDATE_MERCHANT':
      return 'Cambiar merchant activo'
  }
}

/* --- Tone maps --- */

type Tone = 'muted' | 'success' | 'warn' | 'danger' | 'info' | 'accent'

// Color = juicio del estado (saludable / atención / error), nunca identidad.
export const TERMINAL_STATUS_TONE: Record<TerminalStatus, Tone> = {
  PENDING_ACTIVATION: 'warn',
  ACTIVE: 'success',
  INACTIVE: 'muted',
  MAINTENANCE: 'warn', // estado de atención, no dato neutro
  RETIRED: 'muted',
}

// El tipo es una clasificación, no un estado → siempre muted (sin color).
export const TERMINAL_TYPE_TONE: Record<TerminalType, Tone> = {
  TPV_ANDROID: 'muted',
  TPV_IOS: 'muted',
  PRINTER_RECEIPT: 'muted',
  PRINTER_KITCHEN: 'muted',
  KDS: 'muted',
}

/**
 * Categoría de comando para el drawer — agrupar visualmente acciones
 * conceptualmente relacionadas. El tono indica peso operativo:
 * `safe` (rutinario), `warn` (cuidado), `danger` (destructivo, confirm).
 */
export type CommandSeverity = 'safe' | 'warn' | 'danger'

export const COMMAND_SEVERITY: Record<TpvCommand, CommandSeverity> = {
  // Rutina diaria
  RESTART: 'safe',
  CLEAR_CACHE: 'safe',
  SYNC_DATA: 'safe',
  REFRESH_MENU: 'safe',
  UPDATE_CONFIG: 'safe',
  EXPORT_LOGS: 'safe',
  REQUEST_UPDATE: 'safe',
  UNLOCK: 'safe',
  EXIT_MAINTENANCE: 'safe',
  REACTIVATE: 'safe',
  REMOTE_ACTIVATE: 'safe',

  // Acciones disruptivas
  LOCK: 'warn',
  MAINTENANCE_MODE: 'warn',
  FORCE_UPDATE: 'warn',
  INSTALL_VERSION: 'warn',
  UPDATE_MERCHANT: 'warn',

  // Destructivas — confirm tipiado
  SHUTDOWN: 'danger',
  FACTORY_RESET: 'danger',
}
