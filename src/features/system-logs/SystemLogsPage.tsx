import { useCallback, useMemo, useState } from 'react'
import { Braces, Check, ClipboardCopy, Copy, Pause, Play, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/data-table/DataTable'
import {
  DateRangePicker,
  formatDateRangeLabel,
  type DateRangePreset,
  type DateRangeValue,
} from '@/shared/ui/DateRangePicker'
import { HighlightedJson } from '@/shared/components/HighlightedJson'
import { FilterPill, MultiSelectFilterContent, type MultiSelectOption } from '@/shared/filters'
import { QueryError } from '@/shared/components/QueryError'
import {
  DEFAULT_TIMEZONE,
  formatDateTime,
  formatRelative,
  formatTime,
  timezoneShort,
} from '@/shared/lib/datetime'
import { cn } from '@/shared/lib/utils'
import { useSystemLogs } from './use-system-logs'
import { IconButton } from '@/shared/ui/IconButton'
import {
  extractRequestSource,
  formatLogsForClipboard,
  humanizeLevel,
  humanizeRequestSource,
  humanizeType,
  LEVEL_TONE,
  parseLogMessage,
  stripAnsi,
  summarizeMessage,
  type RequestSource,
  type SystemLogEntry,
  type SystemLogLevel,
  type SystemLogType,
} from './types'

const LEVEL_OPTIONS: MultiSelectOption<SystemLogLevel>[] = [
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Advertencia' },
  { value: 'info', label: 'Info' },
]

const TYPE_OPTIONS: MultiSelectOption<SystemLogType>[] = [
  { value: 'app', label: 'App' },
  { value: 'request', label: 'Request' },
  { value: 'build', label: 'Build' },
  { value: 'deploy', label: 'Deploy' },
]

// Orden por frecuencia esperada en tráfico real: dashboard manda el grueso
// de requests, TPV y superadmin son segundos, el resto cae a "Otros".
const SOURCE_OPTIONS: MultiSelectOption<RequestSource>[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'tpv', label: 'TPV' },
  { value: 'superadmin', label: 'Superadmin' },
  { value: 'mobile-pos', label: 'POS móvil' },
  { value: 'consumer', label: 'Consumer' },
  { value: 'webhook', label: 'Webhooks' },
  { value: 'sdk', label: 'SDK' },
  { value: 'sync', label: 'POS-Sync' },
  { value: 'health', label: 'Salud' },
  { value: 'other', label: 'Otros' },
]

function formatActiveLabel<V extends string>(
  selected: Set<V>,
  options: readonly MultiSelectOption<V>[],
): string | null {
  if (selected.size === 0) return null
  const labels = options.filter((o) => selected.has(o.value)).map((o) => o.label)
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return labels.join(', ')
  return `${labels[0]}, ${labels[1]} +${labels.length - 2}`
}

const TYPE_TONE: Record<SystemLogType, 'info' | 'muted' | 'accent' | 'success'> = {
  app: 'info',
  request: 'muted',
  build: 'accent',
  deploy: 'success',
}

/* --- Date range presets for system logs --- */

const LOG_DATE_PRESETS: DateRangePreset[] = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '3 días', hours: 72 },
  { label: '7 días', hours: 168 },
]

export function SystemLogsPage() {
  const [levels, setLevels] = useState<Set<SystemLogLevel>>(new Set())
  const [types, setTypes] = useState<Set<SystemLogType>>(new Set())
  const [sources, setSources] = useState<Set<RequestSource>>(new Set())
  const [dateRange, setDateRange] = useState<DateRangeValue>({})
  // El polling arranca en "live". Cuando el operador necesita leer un log
  // específico sin que la tabla cambie debajo, pausa con el toggle y
  // refresca manualmente con el botón de al lado.
  // Auto-refresh se desactiva cuando hay un rango de fecha explícito (el
  // operador está leyendo un periodo histórico, no un live stream).
  const hasDateRange = !!(dateRange.startTime || dateRange.endTime)
  const [isLive, setIsLive] = useState(true)
  const effectiveLive = isLive && !hasDateRange

  // Si hay UN solo level seleccionado, lo mandamos al server como filter
  // (Render lo aplica más barato que filtrar 100 entries en cliente). Con
  // dos o más, fetch wide y filtrar localmente.
  const serverLevel = levels.size === 1 ? [...levels][0] : undefined

  // «Request» en la UI = "logs que contienen peticiones HTTP" (Winston las
  // emite por stdout → Render las clasifica como type "app", NO "request").
  // Si el operador selecciona Request, no mandamos type al server — hacemos
  // fetch wide y filtramos en cliente con `extractRequestSource`.
  const wantsRequest = types.has('request')
  const renderTypes = new Set([...types].filter((t) => t !== 'request'))
  const serverType = !wantsRequest && renderTypes.size === 1 ? [...renderTypes][0] : undefined

  const query = useSystemLogs(
    {
      level: serverLevel,
      type: serverType,
      startTime: dateRange.startTime,
      endTime: dateRange.endTime,
      limit: 100,
    },
    { refetchEverySeconds: effectiveLive ? 10 : false },
  )

  const filteredLogs = useMemo(() => {
    let logs = query.data?.logs ?? []
    if (levels.size > 1) logs = logs.filter((l) => l.level && levels.has(l.level))

    // Tipo: "request" matchea logs cuyo mensaje contiene un path HTTP
    // (Request End/Start de Winston). Los demás tipos (app, build, deploy)
    // matchean por la clasificación de Render.
    if (types.size > 0) {
      const hasRequest = types.has('request')
      const otherTypes = new Set([...types].filter((t) => t !== 'request'))
      if (hasRequest || otherTypes.size > 1) {
        logs = logs.filter((l) => {
          if (hasRequest && extractRequestSource(l.message) !== null) return true
          if (l.type && (otherTypes as Set<string>).has(l.type)) return true
          return false
        })
      }
    }

    // Origen sólo aplica a logs con path detectable. Si el operador escogió
    // "TPV" o "Dashboard", los logs app/build/deploy sin URL caen del view —
    // ese es el punto del filtro (enfocar tráfico de un cliente específico).
    if (sources.size > 0) {
      logs = logs.filter((l) => {
        const src = extractRequestSource(l.message)
        return src !== null && sources.has(src)
      })
    }
    return logs
  }, [query.data, levels, types, sources])

  const columns = useMemo<ColumnDef<SystemLogEntry, unknown>[]>(
    () => [
      {
        id: 'timestamp',
        header: 'Cuándo',
        accessorFn: (row) => new Date(row.timestamp).getTime(),
        cell: ({ row }) => (
          <>
            <p className="tabular text-[12.5px] text-[var(--ink)]">
              {formatRelative(row.original.timestamp)}
            </p>
            <p className="tabular mt-0.5 text-[10.5px] text-[var(--ink-faint)]">
              {formatDateTime(row.original.timestamp)}
            </p>
          </>
        ),
        sortingFn: 'basic',
        meta: { headerClassName: 'w-[150px]' },
      },
      {
        id: 'level',
        header: 'Nivel',
        accessorFn: (row) => row.level ?? 'zzz',
        cell: ({ row }) =>
          row.original.level ? (
            <Badge tone={LEVEL_TONE[row.original.level]}>{humanizeLevel(row.original.level)}</Badge>
          ) : (
            <span className="text-[11px] text-[var(--ink-faint)]">—</span>
          ),
        meta: { headerClassName: 'w-[110px]' },
      },
      {
        id: 'type',
        header: 'Tipo',
        accessorFn: (row) => row.type ?? 'zzz',
        cell: ({ row }) =>
          row.original.type ? (
            <Badge tone={TYPE_TONE[row.original.type]}>{humanizeType(row.original.type)}</Badge>
          ) : (
            <span className="text-[11px] text-[var(--ink-faint)]">—</span>
          ),
        meta: { headerClassName: 'w-[100px]' },
      },
      {
        id: 'message',
        header: 'Mensaje',
        accessorFn: (row) => row.message,
        cell: ({ row }) => {
          const parsed = parseLogMessage(row.original.message)
          const summary = summarizeMessage(row.original.message)
          const source = extractRequestSource(row.original.message)
          return (
            <p className="break-words text-[13px] leading-snug text-[var(--ink)]">
              {source && (
                <Badge size="sm" tone="muted" className="mr-1.5">
                  {humanizeRequestSource(source)}
                </Badge>
              )}
              {summary}
              {parsed.json !== null && (
                <Badge size="sm" tone="accent" className="ml-1.5">
                  <Braces className="h-2.5 w-2.5" aria-hidden />
                  json
                </Badge>
              )}
            </p>
          )
        },
        enableSorting: false,
      },
    ],
    [],
  )

  const hasActiveFilters = levels.size > 0 || types.size > 0 || sources.size > 0 || hasDateRange

  const resetAllFilters = () => {
    setLevels(new Set())
    setTypes(new Set())
    setSources(new Set())
    setDateRange({})
  }

  const copyAllLogs = useCallback(() => {
    if (filteredLogs.length === 0) {
      toast.info('No hay logs visibles para copiar')
      return
    }
    const text = formatLogsForClipboard(filteredLogs)
    navigator.clipboard.writeText(text).then(
      () =>
        toast.success(
          `${filteredLogs.length} log${filteredLogs.length === 1 ? '' : 's'} copiado${filteredLogs.length === 1 ? '' : 's'}`,
        ),
      () => toast.error('No se pudo copiar — verifica permisos del navegador'),
    )
  }, [filteredLogs])

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <p className="eyebrow">Operaciones</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            Logs del sistema
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Stream en vivo de stdout / stderr / build / requests directo desde Render.
            <span className="tabular ml-2 text-[var(--ink-faint)]">
              · zona base {timezoneShort(DEFAULT_TIMEZONE)} ·{' '}
              {hasDateRange
                ? 'rango fijo (auto-refresh pausado)'
                : isLive
                  ? 'auto-refresh cada 10s'
                  : 'auto-refresh pausado'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-[6px] border border-[var(--line)] bg-[var(--canvas-sunken)] px-2.5"
            aria-live="polite"
          >
            <span
              aria-hidden
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                !effectiveLive
                  ? 'bg-[var(--ink-faint)] shadow-[0_0_0_3px_var(--line)]'
                  : query.isFetching
                    ? 'bg-[var(--accent)] shadow-[0_0_0_3px_var(--accent-faint)]'
                    : 'bg-[var(--success)] shadow-[0_0_0_3px_var(--success-faint)]',
              )}
            />
            {/*
              `inline-block min-w-[88px]` reserva ancho para el texto más largo
              ("Actualizando…") — así la pildora no se contrae cuando vuelve a
              "En vivo", y el tiempo nunca cae a la siguiente línea aunque
              estemos en una pantalla angosta.
            */}
            <span className="tabular text-[12px] text-[var(--ink-muted)]">
              <span className="inline-block min-w-[88px]">
                {!effectiveLive
                  ? hasDateRange
                    ? 'Histórico'
                    : 'Pausado'
                  : query.isFetching
                    ? 'Actualizando…'
                    : 'En vivo'}
              </span>
              {query.dataUpdatedAt > 0 && (
                <span className="text-[var(--ink-faint)]">
                  · {formatTime(new Date(query.dataUpdatedAt).toISOString())}
                </span>
              )}
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setIsLive((v) => !v)}
            aria-pressed={!isLive}
            title={isLive ? 'Pausar el auto-refresh' : 'Reanudar el auto-refresh'}
          >
            {isLive ? (
              <Pause className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden />
            )}
            {isLive ? 'Pausar' : 'Reanudar'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', query.isFetching && 'animate-spin')}
              aria-hidden
            />
            Refrescar
          </Button>
        </div>
      </header>

      {query.isError && (
        <QueryError
          className="mb-5"
          error={query.error}
          context="cargar los logs"
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      {query.data && !query.data.enabled && (
        <div
          role="alert"
          className="mb-5 rounded-[6px] border border-[var(--warn)]/40 bg-[var(--warn-faint)] px-3.5 py-3 text-[13px] text-[var(--warn)]"
        >
          <p className="font-semibold">Logs de Render no configurados</p>
          <p className="mt-0.5 text-[var(--ink-muted)]">
            {query.data.disabledReason ??
              'Configura RENDER_API_KEY y RENDER_SERVICE_ID en avoqado-server.'}
          </p>
        </div>
      )}

      <DataTable
        data={filteredLogs}
        columns={columns}
        searchPlaceholder="Buscar en el mensaje…"
        caption={`Logs en vivo del servicio. ${filteredLogs.length} visibles.`}
        initialSorting={[{ id: 'timestamp', desc: true }]}
        pageSize={20}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              label="Nivel"
              activeLabel={formatActiveLabel(levels, LEVEL_OPTIONS)}
              activeCount={levels.size}
              onClear={() => setLevels(new Set())}
            >
              <MultiSelectFilterContent
                title="Nivel del log"
                options={LEVEL_OPTIONS}
                selected={levels}
                onApply={setLevels}
              />
            </FilterPill>
            <FilterPill
              label="Tipo"
              activeLabel={formatActiveLabel(types, TYPE_OPTIONS)}
              activeCount={types.size}
              onClear={() => setTypes(new Set())}
            >
              <MultiSelectFilterContent
                title="Tipo de log"
                options={TYPE_OPTIONS}
                selected={types}
                onApply={setTypes}
              />
            </FilterPill>
            <FilterPill
              label="Origen"
              activeLabel={formatActiveLabel(sources, SOURCE_OPTIONS)}
              activeCount={sources.size}
              onClear={() => setSources(new Set())}
            >
              <MultiSelectFilterContent
                title="Cliente que originó el request"
                options={SOURCE_OPTIONS}
                selected={sources}
                onApply={setSources}
                searchable
                searchPlaceholder="Buscar origen…"
              />
            </FilterPill>
            <FilterPill
              label="Fecha"
              activeLabel={formatDateRangeLabel(dateRange)}
              activeCount={hasDateRange ? 1 : 0}
              onClear={() => setDateRange({})}
              popoverClassName="w-auto"
            >
              <DateRangePicker
                value={dateRange}
                onApply={setDateRange}
                presets={LOG_DATE_PRESETS}
                showTime
                maxDaysBack={30}
                maxDaysBackHint="Render retiene logs por máximo 30 días."
              />
            </FilterPill>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="ml-1 shrink-0 whitespace-nowrap text-[12px] font-medium text-[var(--danger)] hover:underline"
              >
                Borrar filtros
              </button>
            )}
            <div className="ml-auto">
              <IconButton
                size="sm"
                aria-label={`Copiar ${filteredLogs.length} logs al portapapeles`}
                title={`Copiar ${filteredLogs.length} logs visibles`}
                onClick={copyAllLogs}
                disabled={filteredLogs.length === 0}
              >
                <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
              </IconButton>
            </div>
          </div>
        }
        emptyState={{
          title:
            query.data?.enabled === false
              ? 'Render no configurado'
              : query.isLoading
                ? 'Pidiendo logs…'
                : 'Sin logs visibles',
          description:
            query.data?.enabled === false
              ? 'Configura RENDER_API_KEY y RENDER_SERVICE_ID arriba.'
              : query.isLoading
                ? 'Esto puede tardar unos segundos en cold starts.'
                : 'Ajusta los filtros o espera que Render emita algo.',
        }}
        renderExpandedRow={(log) => <LogDetail log={log} />}
      />

      <p className="mt-3 text-[11.5px] text-[var(--ink-faint)]">
        Retención de logs en Render: ~7 días (free tier), 30 días (paid). Para auditoría histórica
        más larga, considera persistencia en DB.
      </p>
    </div>
  )
}

/**
 * Detalle expandido de una fila. Tres comportamientos según el shape del
 * mensaje:
 *  - Si TODA la línea es JSON: muestra el JSON con syntax highlighting (sin
 *    toggle — no hay otra cosa que ver).
 *  - Si hay JSON trailing en un mensaje de texto: muestra el texto por
 *    default y un botón "Ver JSON" para ver el payload coloreado.
 *  - Si no hay JSON: muestra el mensaje completo en texto plano.
 */
function CopyLogButton({ log }: { log: SystemLogEntry }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const full = stripAnsi(log.message)
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-6 items-center gap-1 rounded-[3px] border border-[var(--line-strong)] bg-[var(--canvas-sunken)] px-1.5 text-[10px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
    >
      {copied ? (
        <Check className="h-2.5 w-2.5 text-[var(--success)]" aria-hidden />
      ) : (
        <Copy className="h-2.5 w-2.5" aria-hidden />
      )}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function LogDetail({ log }: { log: SystemLogEntry }) {
  const parsed = useMemo(() => parseLogMessage(log.message), [log.message])
  const [showJson, setShowJson] = useState(false)
  const hasJson = parsed.json !== null
  const isWholeMessageJson =
    hasJson && (parsed.fullMessage.startsWith('{') || parsed.fullMessage.startsWith('['))

  // Caso 1: toda la línea es JSON → highlighted view directo.
  if (isWholeMessageJson) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[10.5px] text-[var(--ink-faint)]">
          <Braces className="h-3 w-3" aria-hidden />
          <span>Payload JSON</span>
          <CopyLogButton log={log} />
        </div>
        <HighlightedJson value={parsed.json} />
      </div>
    )
  }

  // Caso 2: texto + JSON trailing → toggle entre texto y JSON.
  if (hasJson) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[10.5px] text-[var(--ink-faint)]">
          <span>{showJson ? 'Payload JSON' : 'Mensaje completo'}</span>
          <button
            type="button"
            onClick={() => setShowJson((v) => !v)}
            className="inline-flex h-6 items-center gap-1 rounded-[3px] border border-[var(--line-strong)] bg-[var(--canvas-sunken)] px-1.5 text-[10px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            <Braces className="h-2.5 w-2.5" aria-hidden />
            {showJson ? 'Ver mensaje' : 'Ver JSON'}
          </button>
          <CopyLogButton log={log} />
        </div>
        {showJson ? (
          <HighlightedJson value={parsed.json} />
        ) : (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-[4px] border border-[var(--line)] bg-[var(--canvas)] p-2 font-mono text-[11.5px] leading-relaxed text-[var(--ink)]">
            {parsed.fullMessage}
          </pre>
        )}
      </div>
    )
  }

  // Caso 3: sólo texto.
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[10.5px] text-[var(--ink-faint)]">
        <span>Mensaje completo</span>
        <CopyLogButton log={log} />
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-[4px] border border-[var(--line)] bg-[var(--canvas)] p-2 font-mono text-[11.5px] leading-relaxed text-[var(--ink)]">
        {parsed.fullMessage}
      </pre>
    </div>
  )
}
