/**
 * Types matching the proxy response from
 * `GET /api/v1/superadmin/system-logs` in avoqado-server, which itself
 * proxies the Render Logs API.
 */

export type SystemLogLevel = 'info' | 'warning' | 'error'
export type SystemLogType = 'app' | 'request' | 'build' | 'deploy'

export interface SystemLogEntry {
  id: string
  timestamp: string
  message: string
  level: SystemLogLevel | null
  type: SystemLogType | null
  labels: Array<{ name: string; value: string }>
}

export interface SystemLogsResponse {
  enabled: boolean
  /** Cuando `enabled === false`, explica por qué (env vars faltantes, key revocada, etc.). */
  disabledReason?: string
  logs: SystemLogEntry[]
  hasMore: boolean
  nextEndTime?: string
}

export interface SystemLogsQueryParams {
  level?: SystemLogLevel
  type?: SystemLogType
  startTime?: string
  endTime?: string
  search?: string
  limit?: number
}

/* --- UI helpers --- */

/**
 * Limpia secuencias ANSI de los logs (colores del terminal de Render llegan
 * con `[31m` y similares). Los queremos planos para renderizar.
 */
export function stripAnsi(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
}

export function humanizeLevel(level: SystemLogLevel | null): string {
  if (level === 'info') return 'Info'
  if (level === 'warning') return 'Advertencia'
  if (level === 'error') return 'Error'
  return '—'
}

export function humanizeType(type: SystemLogType | null): string {
  if (type === 'app') return 'App'
  if (type === 'request') return 'Request'
  if (type === 'build') return 'Build'
  if (type === 'deploy') return 'Deploy'
  return '—'
}

export const LEVEL_TONE: Record<SystemLogLevel, 'info' | 'warn' | 'danger'> = {
  info: 'info',
  warning: 'warn',
  error: 'danger',
}
