import { useMemo, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/shared/ui/Badge'
import { IconButton } from '@/shared/ui/IconButton'
import { DataTable } from '@/shared/data-table/DataTable'
import { FilterPill, MultiSelectFilterContent, type MultiSelectOption } from '@/shared/filters'
import { QueryError } from '@/shared/components/QueryError'
import {
  DateRangePicker,
  formatDateRangeLabel,
  type DateRangePreset,
  type DateRangeValue,
} from '@/shared/ui/DateRangePicker'
import {
  DEFAULT_TIMEZONE,
  formatDateTime,
  formatRelative,
  timezoneShort,
} from '@/shared/lib/datetime'
import { useActivityLog } from './use-activity-log'
import {
  actorDisplayName,
  categorizeEntry,
  humanizeAction,
  humanizeEntity,
  severityFor,
  type ActivityCategory,
  type ActivityLogEntry,
  type ActivitySeverity,
} from './types'

const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  auth: 'Auth',
  kyc: 'KYC',
  venue: 'Venue',
  terminal: 'Terminal',
  payment: 'Pago',
  config: 'Config',
}

const SEVERITY_TONE: Record<ActivitySeverity, 'muted' | 'success' | 'warn' | 'danger' | 'info'> = {
  info: 'info',
  success: 'success',
  warn: 'warn',
  danger: 'danger',
}

const SEVERITY_LABEL: Record<ActivitySeverity, string> = {
  info: 'informativo',
  success: 'éxito',
  warn: 'advertencia',
  danger: 'crítico',
}

const CATEGORY_OPTIONS: MultiSelectOption<ActivityCategory>[] = [
  { value: 'auth', label: 'Auth' },
  { value: 'kyc', label: 'KYC' },
  { value: 'venue', label: 'Venue' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'payment', label: 'Pago' },
  { value: 'config', label: 'Config' },
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

const LOG_DATE_PRESETS: DateRangePreset[] = [
  { label: '1h', hours: 1 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
]

export function ActivityLogPage() {
  const [categories, setCategories] = useState<Set<ActivityCategory>>(new Set())
  const [dateRange, setDateRange] = useState<DateRangeValue>({})

  const query = useActivityLog({
    page: 1,
    pageSize: 100,
    startDate: dateRange.startTime,
    endDate: dateRange.endTime,
  })

  const entries = useMemo(() => {
    const logs = query.data?.logs ?? []
    if (categories.size === 0) return logs
    return logs.filter((log) => categories.has(categorizeEntry(log)))
  }, [query.data, categories])

  const columns = useMemo<ColumnDef<ActivityLogEntry, unknown>[]>(
    () => [
      {
        id: 'createdAt',
        header: 'Cuándo',
        accessorFn: (row) => new Date(row.createdAt).getTime(),
        cell: ({ row }) => {
          const e = row.original
          return (
            <>
              <p className="tabular text-[13px] text-[var(--ink)]">{formatRelative(e.createdAt)}</p>
              <p className="tabular mt-0.5 text-[11px] text-[var(--ink-faint)]">
                {formatDateTime(e.createdAt)}
              </p>
            </>
          )
        },
        sortingFn: 'basic',
        meta: { headerClassName: 'w-[150px]' },
      },
      {
        id: 'actor',
        header: 'Actor',
        accessorFn: (row) => actorDisplayName(row.staff),
        cell: ({ row }) => {
          const e = row.original
          return (
            <>
              <p className="text-[13px] font-medium text-[var(--ink)]">
                {actorDisplayName(e.staff)}
              </p>
              {e.venueName && (
                <p className="mt-0.5 text-[11.5px] text-[var(--ink-faint)]">{e.venueName}</p>
              )}
            </>
          )
        },
        meta: { headerClassName: 'w-[180px]' },
      },
      {
        id: 'category',
        header: 'Categoría',
        accessorFn: (row) => CATEGORY_LABEL[categorizeEntry(row)],
        cell: ({ row }) => {
          const e = row.original
          const cat = categorizeEntry(e)
          const sev = severityFor(e.action)
          return (
            <Badge tone={SEVERITY_TONE[sev]}>
              {CATEGORY_LABEL[cat]}
              <span className="sr-only"> ({SEVERITY_LABEL[sev]})</span>
            </Badge>
          )
        },
        meta: { headerClassName: 'w-[120px]' },
      },
      {
        id: 'action',
        header: 'Acción',
        accessorFn: (row) =>
          [row.action, row.entity, row.entityId, row.organizationName].filter(Boolean).join(' '),
        cell: ({ row }) => {
          const e = row.original
          return (
            <>
              <p className="text-[13.5px] leading-snug text-[var(--ink)]">
                {humanizeAction(e.action)}
              </p>
              {(e.entity || e.entityId) && (
                <p className="mt-1 text-[11.5px] text-[var(--ink-muted)]">
                  {e.entity && <span>{humanizeEntity(e.entity)}</span>}
                  {e.entity && e.entityId && <span className="mx-1 opacity-40">·</span>}
                  {e.entityId && <span className="font-mono break-all">{e.entityId}</span>}
                </p>
              )}
            </>
          )
        },
        enableSorting: false,
      },
      {
        id: 'source',
        header: 'Origen',
        accessorFn: (row) => row.ipAddress ?? '',
        cell: ({ row }) => (
          <p className="font-mono tabular text-[12px] text-[var(--ink-muted)]">
            {row.original.ipAddress ?? '—'}
          </p>
        ),
        meta: { headerClassName: 'w-[160px]' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Acciones</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-right">
            <IconButton
              size="md"
              aria-label={`Ver detalle del evento ${row.original.id}`}
              className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </IconButton>
          </div>
        ),
        meta: { headerClassName: 'w-[60px]', cellClassName: 'text-right' },
      },
    ],
    [],
  )

  const total = query.data?.pagination.total ?? 0
  const loaded = query.data?.logs.length ?? 0

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <p className="eyebrow">Auditoría</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            Activity log
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Cada acción registrada por el equipo y los procesos del sistema.
            <span className="tabular ml-2 text-[var(--ink-faint)]">
              · zona base {timezoneShort(DEFAULT_TIMEZONE)}
              {total > 0 && (
                <>
                  {' '}
                  · {loaded} de {total} cargados
                </>
              )}
            </span>
          </p>
        </div>
      </header>

      {query.isError && (
        <QueryError
          className="mb-5"
          error={query.error}
          context="cargar el activity log"
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      <DataTable
        data={entries}
        columns={columns}
        searchPlaceholder="Buscar acción, actor, venue…"
        caption={`Eventos registrados. ${entries.length} visibles.`}
        initialSorting={[{ id: 'createdAt', desc: true }]}
        pageSize={20}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              label="Fecha"
              activeLabel={formatDateRangeLabel(dateRange)}
              activeCount={dateRange.startTime ? 1 : 0}
              onClear={() => setDateRange({})}
              popoverClassName="w-auto"
            >
              <DateRangePicker
                value={dateRange}
                onApply={setDateRange}
                presets={LOG_DATE_PRESETS}
              />
            </FilterPill>
            <FilterPill
              label="Categoría"
              activeLabel={formatActiveLabel(categories, CATEGORY_OPTIONS)}
              activeCount={categories.size}
              onClear={() => setCategories(new Set())}
            >
              <MultiSelectFilterContent
                title="Categoría de acción"
                options={CATEGORY_OPTIONS}
                selected={categories}
                onApply={setCategories}
              />
            </FilterPill>
          </div>
        }
        emptyState={{
          title: query.isLoading ? 'Cargando…' : 'Sin coincidencias',
          description: query.isLoading
            ? 'Pidiendo eventos al servidor.'
            : 'Ajusta el filtro o limpia la búsqueda para volver a ver todo el log.',
        }}
        exportable={{
          filename: 'avoqado-activity-log',
          dateAccessor: (row) => row.createdAt,
          columns: [
            { key: 'createdAt', header: 'Cuándo (UTC)', accessor: (r) => r.createdAt },
            { key: 'actor', header: 'Actor', accessor: (r) => actorDisplayName(r.staff) },
            {
              key: 'category',
              header: 'Categoría',
              accessor: (r) => CATEGORY_LABEL[categorizeEntry(r)],
            },
            {
              key: 'severity',
              header: 'Severidad',
              accessor: (r) => SEVERITY_LABEL[severityFor(r.action)],
            },
            { key: 'action', header: 'Acción', accessor: (r) => r.action },
            { key: 'entity', header: 'Entity', accessor: (r) => r.entity ?? '' },
            { key: 'entityId', header: 'Entity ID', accessor: (r) => r.entityId ?? '' },
            { key: 'venue', header: 'Venue', accessor: (r) => r.venueName ?? '' },
            {
              key: 'organization',
              header: 'Organización',
              accessor: (r) => r.organizationName ?? '',
            },
            { key: 'ip', header: 'IP', accessor: (r) => r.ipAddress ?? '' },
          ],
        }}
      />
    </div>
  )
}
