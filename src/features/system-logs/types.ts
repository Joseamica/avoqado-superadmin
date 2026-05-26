/**
 * Types matching the proxy response from
 * `GET /api/v1/superadmin/system-logs` in avoqado-server, which itself
 * proxies the Render Logs API.
 */

export type SystemLogLevel = 'info' | 'warning' | 'error'
export type SystemLogType = 'app' | 'request' | 'build' | 'deploy'

/**
 * Cliente que originó un request, derivado del path. El backend monta cada
 * superficie del producto bajo un prefix distinto de `/api/v1/*`, así que
 * basta con leer el primer segmento del path para saber de dónde vino el
 * tráfico. Lista basada en `avoqado-server/src/routes/index.ts`.
 *
 * `null` cuando el log no es un request o no logramos detectar el path
 * (errores app-level sin URL, build/deploy logs, etc.).
 */
export type RequestSource =
  | 'tpv' // avoqado-tpv (PAX terminals)
  | 'mobile-pos' // avoqado-android, avoqado-ios
  | 'dashboard' // avoqado-web-dashboard + /analytics, /organizations, /me (todas son superficies del mismo dashboard)
  | 'superadmin' // avoqado-superadmin (este app)
  | 'consumer' // avoqado-consumer-app
  | 'webhook' // Stripe, MercadoPago, Google Calendar, otros webhooks externos
  | 'sdk' // Payment SDK + integraciones partner
  | 'sync' // avoqado-windows-service (pos-sync)
  | 'health' // load balancer health checks + métricas públicas
  | 'other' // /onboarding, /invitations, /public, /live-demo, etc.

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

export function humanizeRequestSource(source: RequestSource): string {
  switch (source) {
    case 'tpv':
      return 'TPV'
    case 'mobile-pos':
      return 'POS móvil'
    case 'dashboard':
      return 'Dashboard'
    case 'superadmin':
      return 'Superadmin'
    case 'consumer':
      return 'Consumer'
    case 'webhook':
      return 'Webhooks'
    case 'sdk':
      return 'SDK'
    case 'sync':
      return 'POS-Sync'
    case 'health':
      return 'Salud'
    case 'other':
      return 'Otros'
  }
}

/**
 * Extrae el cliente que originó el request leyendo el path del mensaje. El
 * patrón típico es `Request End: GET /api/v1/<segmento>/... - 200 [12ms]`,
 * pero también acepta paths que aparezcan en mensajes de error (ej.
 * `Error processing /api/v1/tpv/payments — DB timeout`). Devuelve `null`
 * cuando no hay path detectable.
 */
export function extractRequestSource(message: string): RequestSource | null {
  const stripped = stripAnsi(message)
  // Primer match de path. Capturamos varios shapes:
  //   /api/v1/<segmento>          — la mayoría de las rutas montadas
  //   /api/v1/integrations/<x>    — webhooks externos (MP, etc.)
  //   /api/public/<x>             — healthcheck / metrics
  //   /health                     — load balancer
  //   /reports/<x>                — settlement reports
  const pathMatch = stripped.match(
    /\/(api\/v1\/[\w-]+(?:\/[\w-]+)?|api\/public(?:\/[\w-]+)?|health|reports\/[\w-]+)/,
  )
  if (!pathMatch) return null
  const path = pathMatch[1].toLowerCase()

  // /api/v1/<segmento>
  const v1 = path.match(/^api\/v1\/([\w-]+)(?:\/([\w-]+))?/)
  if (v1) {
    const seg = v1[1]
    switch (seg) {
      case 'tpv':
        return 'tpv'
      case 'mobile':
        return 'mobile-pos'
      // Todas estas URLs viven dentro del dashboard de admin web. El backend las
      // separó por dominio (analytics, organizations, me) pero para el operador
      // del superadmin todas son "tráfico de dashboard".
      case 'dashboard':
      case 'analytics':
      case 'organizations':
      case 'me':
        return 'dashboard'
      case 'superadmin':
        return 'superadmin'
      case 'consumer':
        return 'consumer'
      case 'webhooks':
      case 'google-calendar':
        return 'webhook'
      // /api/v1/integrations/mercadopago/...
      case 'integrations':
        return 'webhook'
      case 'sdk':
        return 'sdk'
      case 'pos-sync':
        return 'sync'
      case 'onboarding':
      case 'invitations':
      case 'partner':
      case 'public':
      case 'live-demo':
      case 'demo':
      case 'venues':
        return 'other'
      default:
        return 'other'
    }
  }

  if (path.startsWith('api/public') || path === 'health') return 'health'
  if (path.startsWith('reports/')) return 'other'
  return null
}

export const LEVEL_TONE: Record<SystemLogLevel, 'info' | 'warn' | 'danger'> = {
  info: 'info',
  warning: 'warn',
  error: 'danger',
}

/**
 * Resultado de parsear una línea de log de Render.
 *
 * Render almacena el `stdout` crudo del servicio. Como avoqado-server usa
 * Winston, esto suele venir con la forma `level: [TAG] mensaje {json}` o
 * un stack trace multilínea. El visualizador debe (a) mostrar algo breve y
 * legible por default, (b) ofrecer el detalle completo bajo demanda, y
 * (c) si hay un objeto JSON embebido al final, mostrarlo formateado.
 */
export interface ParsedLogMessage {
  /** Una línea, sin ANSI, sin el JSON trailing — lo que se muestra colapsado. */
  summary: string
  /** Mensaje completo limpio (ANSI stripped). Lo que se muestra al expandir. */
  fullMessage: string
  /** JSON detectado al final del mensaje (o el cuerpo entero si toda la línea es JSON). null si no hay. */
  json: unknown | null
}

export function parseLogMessage(message: string): ParsedLogMessage {
  const stripped = stripAnsi(message).trim()
  let json: unknown | null = null
  let summary = stripped

  // Caso A: mensaje termina con `{...}` JSON (patrón Winston más común)
  const trailingJsonMatch = stripped.match(/\s+(\{[\s\S]*\})\s*$/)
  if (trailingJsonMatch && trailingJsonMatch.index !== undefined) {
    try {
      json = JSON.parse(trailingJsonMatch[1])
      summary = stripped.slice(0, trailingJsonMatch.index).trim()
    } catch {
      /* el `{...}` no era JSON válido (ej. una llave de objeto en texto natural) — ignoramos. */
    }
  }

  // Caso B: la línea ENTERA es JSON
  if (!json && (stripped.startsWith('{') || stripped.startsWith('['))) {
    try {
      json = JSON.parse(stripped)
      // Si toda la línea era JSON, el summary deja un hint
      summary = '(payload JSON — expande para ver)'
    } catch {
      /* ignoramos */
    }
  }

  // Summary siempre una línea — multi-línea va al expansor
  const firstLine = summary.split('\n')[0].trim()
  return { summary: firstLine, fullMessage: stripped, json }
}

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/**
 * Convierte un log crudo de Render en una frase legible. Reconoce patrones
 * comunes (Winston level prefix, HTTP request lines, errores de Prisma,
 * timeouts, mensajes de Render API, JSON trailing) y los reescribe a algo
 * que un operador entiende sin pensar. Si nada matchea, hace un cleanup
 * suave (primera línea, sin ANSI, sin correlation ID).
 */
export function summarizeMessage(message: string): string {
  const stripped = stripAnsi(message).trim()
  let s = stripped

  // 0. Caso whole-line JSON: extraer el campo `message`/`msg`/`error` como summary
  // y añadir un par de pares clave-valor secundarios como contexto.
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>
        const headlineField = obj.message ?? obj.msg ?? obj.error ?? obj.err
        if (typeof headlineField === 'string') {
          const noisyKeys = new Set([
            'message',
            'msg',
            'error',
            'err',
            'correlationId',
            'timestamp',
            'level',
            'stack',
          ])
          const interestingKeys = Object.keys(obj).filter((k) => !noisyKeys.has(k))
          if (interestingKeys.length === 0) return headlineField
          if (interestingKeys.length <= 3) {
            const detail = interestingKeys
              .map((k) => {
                const v = obj[k]
                let display: string
                if (v === null) display = 'null'
                else if (Array.isArray(v)) display = `[${v.length}]`
                else if (typeof v === 'object') display = '{…}'
                else if (typeof v === 'string') display = v.length > 30 ? `${v.slice(0, 30)}…` : v
                else display = String(v)
                return `${k}=${display}`
              })
              .join(', ')
            return `${headlineField} — ${detail}`
          }
          return `${headlineField} (+${interestingKeys.length} campos)`
        }
        const keys = Object.keys(obj)
        const preview = keys.slice(0, 3).join(', ')
        return `JSON con ${keys.length} campo${keys.length === 1 ? '' : 's'}: ${preview}${keys.length > 3 ? '…' : ''}`
      }
    } catch {
      /* no era JSON válido, continuamos al resto del parser */
    }
  }

  // 1. Strip Winston level prefix ("info: ...", "error: ...")
  s = s.replace(/^(info|warn|warning|error|debug|verbose|silly|http):\s*/i, '')

  // 2. HTTP request line: "Request End: METHOD /path - STATUS [Nms]"
  const httpMatch = s.match(/^Request End:\s*(\w+)\s+(\S+)\s*-\s*(\d{3})\s*\[(\d+(?:\.\d+)?)ms\]/i)
  if (httpMatch) {
    const [, method, path, status, ms] = httpMatch
    return `${method} ${path} → ${status} (${Math.round(parseFloat(ms))} ms)`
  }

  // 3. Prisma error: "Invalid `prisma.X.Y()` invocation"
  const prismaMatch = stripped.match(/Invalid `(prisma\.[\w.]+\(\))` invocation/)
  if (prismaMatch) {
    const reason = stripped.match(/Invalid value for argument `(\w+)`\.\s*([^.\n]+)/)
    if (reason) {
      return `Prisma rechazó ${prismaMatch[1]}: argumento "${reason[1]}" ${reason[2].toLowerCase().trim()}`
    }
    return `Error en ${prismaMatch[1]}`
  }

  // 4. Timeout
  const timeoutMatch = s.match(/timeout of (\d+)ms exceeded/i)
  if (timeoutMatch) {
    return `La petición se tardó más de ${timeoutMatch[1]} ms y fue cancelada por timeout`
  }

  // 5. Network errors comunes
  if (/ECONNREFUSED/.test(s)) return 'No pudimos conectar — el servicio remoto rechazó la conexión'
  if (/ECONNRESET/.test(s)) return 'La conexión se cortó del otro lado'
  if (/ETIMEDOUT/.test(s)) return 'La conexión expiró antes de responder'
  if (/ENOTFOUND/.test(s)) return 'DNS no resolvió el host'

  // 6. Render API error
  const renderApi = s.match(/Render API (\d+|no-status):\s*(.+?)(?:,?\s*CorrelationID|$)/)
  if (renderApi) {
    return `Render API respondió ${renderApi[1]}: ${renderApi[2].trim()}`
  }

  // 7. [TAG] prefix → mantenerlo como contexto
  const taggedMatch = s.match(/^\[([\w-]+)\]\s+(.+)/)
  let tag: string | null = null
  if (taggedMatch) {
    tag = taggedMatch[1]
    s = taggedMatch[2]
  }

  // 8. Trailing JSON — resumirlo en línea
  let jsonSummary = ''
  const jsonMatch = s.match(/^(.+?)\s+(\{[\s\S]*\})\s*$/)
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[2]) as unknown
      jsonSummary = summarizeJsonInline(obj)
      s = jsonMatch[1].trim()
    } catch {
      /* ignore */
    }
  }

  // 9. Strip "Unexpected Error:" prefix
  s = s.replace(/^Unexpected Error:\s*/i, '')

  // 10. Strip trailing CorrelationID
  s = s.replace(/,?\s*CorrelationID:\s*[\w-]+\s*$/i, '')

  // 11. Primera línea (para stack traces multi-línea)
  s = s.split('\n')[0].trim()

  // 12. Componer resultado
  let result = tag ? `[${tag}] ${s}` : s
  if (jsonSummary) result += ` — ${jsonSummary}`
  return result || stripped.split('\n')[0]
}

/* --- Clipboard helpers --- */

/**
 * Formatea un log entry para pegar en Slack / ticket / terminal.
 * Línea única: `[2026-05-26 08:45:32] [ERROR] [App] mensaje limpio`
 */
export function formatLogForClipboard(log: SystemLogEntry): string {
  const ts = log.timestamp.replace('T', ' ').replace(/\.\d+Z$/, '')
  const level = log.level ? `[${log.level.toUpperCase()}]` : ''
  const type = log.type ? `[${humanizeType(log.type)}]` : ''
  const msg = stripAnsi(log.message).split('\n')[0].trim()
  return [ts, level, type, msg].filter(Boolean).join(' ')
}

/**
 * Formatea un array de logs para clipboard. Cada log en su línea,
 * header con conteo + rango de timestamps.
 */
export function formatLogsForClipboard(logs: SystemLogEntry[]): string {
  if (logs.length === 0) return '(sin logs visibles)'
  const lines = logs.map(formatLogForClipboard)
  const oldest = logs[logs.length - 1].timestamp.replace('T', ' ').replace(/\.\d+Z$/, '')
  const newest = logs[0].timestamp.replace('T', ' ').replace(/\.\d+Z$/, '')
  const header = `--- ${logs.length} log${logs.length === 1 ? '' : 's'} · ${oldest} → ${newest} ---`
  return [header, ...lines].join('\n')
}

function summarizeJsonInline(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return `[${value.length} elementos]`
  if (typeof value !== 'object') return String(value)

  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.length === 0) return '{}'
  if (keys.length > 3) return `${keys.length} campos`

  return keys
    .map((k) => {
      const v = obj[k]
      let display: string
      if (v === null) display = 'null'
      else if (Array.isArray(v)) display = `[${v.length}]`
      else if (typeof v === 'object') display = '{…}'
      else if (typeof v === 'string') display = v.length > 40 ? `${v.slice(0, 40)}…` : v
      else display = String(v)
      return `${k}=${display}`
    })
    .join(', ')
}
