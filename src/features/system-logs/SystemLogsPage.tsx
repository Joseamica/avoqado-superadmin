import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Filter, RefreshCw } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
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
import {
  humanizeLevel,
  humanizeType,
  LEVEL_TONE,
  stripAnsi,
  type SystemLogLevel,
  type SystemLogType,
} from './types'

const LEVELS: (SystemLogLevel | 'all')[] = ['all', 'error', 'warning', 'info']
const TYPES: (SystemLogType | 'all')[] = ['all', 'app', 'request', 'build', 'deploy']

const TYPE_TONE: Record<SystemLogType, 'info' | 'muted' | 'accent' | 'success'> = {
  app: 'info',
  request: 'muted',
  build: 'accent',
  deploy: 'success',
}

export function SystemLogsPage() {
  const [level, setLevel] = useState<SystemLogLevel | 'all'>('all')
  const [type, setType] = useState<SystemLogType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const query = useSystemLogs(
    {
      level: level === 'all' ? undefined : level,
      type: type === 'all' ? undefined : type,
      limit: 100,
    },
    { refetchEverySeconds: 10 },
  )

  const filteredLogs = useMemo(() => {
    const logs = query.data?.logs ?? []
    if (!search.trim()) return logs
    const needle = search.toLowerCase()
    return logs.filter((l) => l.message.toLowerCase().includes(needle))
  }, [query.data, search])

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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
              · zona base {timezoneShort(DEFAULT_TIMEZONE)} · auto-refresh cada 10s
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-[6px] border border-[var(--line)] bg-[var(--canvas-sunken)] px-2.5 py-1.5">
            <span
              aria-hidden
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                query.isFetching
                  ? 'bg-[var(--accent)] shadow-[0_0_0_3px_var(--accent-faint)]'
                  : 'bg-[var(--success)] shadow-[0_0_0_3px_var(--success-faint)]',
              )}
            />
            <span className="tabular text-[12px] text-[var(--ink-muted)]">
              {query.isFetching ? 'Actualizando…' : 'En vivo'}
              {query.dataUpdatedAt > 0 && (
                <span className="ml-1.5 text-[var(--ink-faint)]">
                  · {formatTime(new Date(query.dataUpdatedAt).toISOString())}
                </span>
              )}
            </span>
          </div>
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

      <div className="mb-5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-2.5">
        <div className="relative min-w-[260px] flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en el mensaje…"
            aria-label="Buscar en los logs"
            className="h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[13px] placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
        </div>
        <FilterPills
          label="Nivel"
          value={level}
          options={LEVELS}
          formatLabel={(v) => (v === 'all' ? 'Todo' : humanizeLevel(v as SystemLogLevel))}
          onChange={setLevel}
        />
        <FilterPills
          label="Tipo"
          value={type}
          options={TYPES}
          formatLabel={(v) => (v === 'all' ? 'Todo' : humanizeType(v as SystemLogType))}
          onChange={setType}
        />
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)]">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">
            Logs en vivo del servicio. {filteredLogs.length} visibles.
          </caption>
          <thead>
            <tr className="border-b border-[var(--line-strong)] bg-[var(--canvas-sunken)]">
              <th scope="col" className="w-[40px] px-2 py-2.5"></th>
              <th
                scope="col"
                className="w-[160px] px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[var(--ink-faint)]"
              >
                Cuándo
              </th>
              <th
                scope="col"
                className="w-[110px] px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[var(--ink-faint)]"
              >
                Nivel
              </th>
              <th
                scope="col"
                className="w-[100px] px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[var(--ink-faint)]"
              >
                Tipo
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[var(--ink-faint)]"
              >
                Mensaje
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 && !query.isLoading && (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center">
                  <p className="font-display text-[15px] font-semibold text-[var(--ink)]">
                    {query.data?.enabled === false ? 'Render no configurado' : 'Sin logs visibles'}
                  </p>
                  <p className="mt-1 text-[12.5px] text-[var(--ink-faint)]">
                    {query.data?.enabled === false
                      ? 'Configura RENDER_API_KEY y RENDER_SERVICE_ID arriba.'
                      : 'Ajusta los filtros o espera que Render emita algo.'}
                  </p>
                </td>
              </tr>
            )}
            {query.isLoading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-14 text-center text-[12.5px] text-[var(--ink-faint)]"
                >
                  Pidiendo logs a Render…
                </td>
              </tr>
            )}
            {filteredLogs.map((log) => {
              const isOpen = expanded.has(log.id)
              const cleanMessage = stripAnsi(log.message)
              const firstLine = cleanMessage.split('\n')[0] ?? cleanMessage
              const hasMore = cleanMessage.length > firstLine.length
              return (
                <tr
                  key={log.id}
                  className="border-b border-[var(--line)] transition-colors last:border-b-0 hover:bg-[var(--canvas-sunken)]/40"
                >
                  <td className="px-2 py-2.5 align-top">
                    {hasMore ? (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(log.id)}
                        aria-label={isOpen ? 'Contraer' : 'Expandir'}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] text-[var(--ink-faint)] hover:bg-[var(--canvas-sunken)] hover:text-[var(--ink)]"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    ) : (
                      <span className="inline-block h-6 w-6" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <p className="tabular text-[12.5px] text-[var(--ink)]">
                      {formatRelative(log.timestamp)}
                    </p>
                    <p className="tabular mt-0.5 text-[10.5px] text-[var(--ink-faint)]">
                      {formatDateTime(log.timestamp)}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {log.level ? (
                      <Badge tone={LEVEL_TONE[log.level]}>{humanizeLevel(log.level)}</Badge>
                    ) : (
                      <span className="text-[11px] text-[var(--ink-faint)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {log.type ? (
                      <Badge tone={TYPE_TONE[log.type]}>{humanizeType(log.type)}</Badge>
                    ) : (
                      <span className="text-[11px] text-[var(--ink-faint)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-snug text-[var(--ink)]">
                      {isOpen ? cleanMessage : firstLine}
                    </pre>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <footer className="mt-3 flex flex-col gap-2 text-[11.5px] text-[var(--ink-faint)] sm:flex-row sm:items-center sm:justify-between">
        <span className="tabular">
          {filteredLogs.length} de {query.data?.logs.length ?? 0} logs visibles
          {query.data?.hasMore && (
            <span className="ml-1.5 text-[var(--ink-muted)]">· Render tiene más, sube `limit`</span>
          )}
        </span>
        <span>
          Retención del free tier de Render: ~7 días. Para auditoría histórica, configura DB
          persistence (Phase 2).
        </span>
      </footer>
    </div>
  )
}

function FilterPills<T extends string>({
  label,
  value,
  options,
  formatLabel,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  formatLabel: (v: T) => string
  onChange: (v: T) => void
}) {
  return (
    <div
      role="group"
      aria-label={`Filtrar por ${label.toLowerCase()}`}
      className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto rounded-[6px] border border-[var(--line)] bg-[var(--canvas)] p-1 sm:mx-0"
    >
      <Filter className="mx-1.5 h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]" aria-hidden />
      {options.map((o) => {
        const isActive = value === o
        return (
          <button
            key={o}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(o)}
            className={cn(
              'h-9 shrink-0 rounded-[4px] px-3 text-[12px] font-medium uppercase tracking-[0.06em] transition-colors',
              isActive
                ? 'bg-[var(--ink)] text-[var(--canvas)]'
                : 'text-[var(--ink-muted)] hover:bg-[var(--canvas-sunken)] hover:text-[var(--ink)]',
            )}
          >
            {formatLabel(o)}
          </button>
        )
      })}
    </div>
  )
}
