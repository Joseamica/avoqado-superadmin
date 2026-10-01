import { ExportDialog } from '@/shared/data-table/ExportDialog'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Cpu, Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/shared/ui/Button'
import { useDebounced } from '@/shared/hooks/useDebounced'
import { exportTpvFleet, type FleetPage } from './api'
import { Badge } from '@/shared/ui/Badge'
import { IconButton } from '@/shared/ui/IconButton'
import { buttonVariants } from '@/shared/ui/button-variants'
import { DataTable } from '@/shared/data-table/DataTable'
import {
  FilterPill,
  MultiSelectFilterContent,
  SingleSelectFilterContent,
  type MultiSelectOption,
  type SingleSelectOption,
} from '@/shared/filters'
import { QueryError } from '@/shared/components/QueryError'
import {
  DEFAULT_TIMEZONE,
  formatDateTime,
  formatRelative,
  timezoneShort,
} from '@/shared/lib/datetime'
import { cn } from '@/shared/lib/utils'
import { TerminalActionDrawer } from './TerminalActionDrawer'
import { TerminalsByVenueList } from './TerminalsByVenueList'
import { useTerminals, useTerminalDetail } from './use-terminals'
import {
  canBeActivated,
  humanizeTerminalStatus,
  humanizeTerminalType,
  isTerminalOnline,
  TERMINAL_STATUS_TONE,
  TERMINAL_TYPE_TONE,
  type Terminal,
  type TerminalStatus,
  type TerminalType,
} from './types'

const NUM = new Intl.NumberFormat('es-MX')

const STATUS_OPTIONS: MultiSelectOption<TerminalStatus>[] = [
  { value: 'ACTIVE', label: 'Activa' },
  { value: 'PENDING_ACTIVATION', label: 'Sin activar' },
  { value: 'MAINTENANCE', label: 'En mantenimiento' },
  { value: 'INACTIVE', label: 'Inactiva' },
  { value: 'RETIRED', label: 'Retirada' },
]

const TYPE_OPTIONS: MultiSelectOption<TerminalType>[] = [
  { value: 'TPV_ANDROID', label: 'TPV Android' },
  { value: 'TPV_IOS', label: 'TPV iOS' },
]

// "Conexión" = online/offline derivado de lastHeartbeat. Es una vista
// independiente del status (un terminal puede estar ACTIVE pero offline).
type ConnectionOption = 'all' | 'online' | 'offline' | 'pending'

const CONNECTION_OPTIONS: SingleSelectOption<ConnectionOption>[] = [
  { value: 'all', label: 'Cualquier conexión' },
  { value: 'online', label: 'Solo online', description: 'Contacto en los últimos 2 minutos' },
  { value: 'offline', label: 'Solo offline', description: 'Sin heartbeat reciente' },
  { value: 'pending', label: 'Sin activar', description: 'PENDING_ACTIVATION + sin activatedAt' },
]

type GroupByOption = 'none' | 'venue'

const GROUP_BY_OPTIONS: SingleSelectOption<GroupByOption>[] = [
  { value: 'none', label: 'Sin agrupar', description: 'Lista con búsqueda y exportación' },
  { value: 'venue', label: 'Por venue', description: 'Agrupar las TPVs de esta página por venue' },
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

interface KpiTile {
  label: string
  value: string
  footnote?: string
  tone: 'actionable' | 'default'
}

interface KpiData {
  focus: KpiTile
  rest: KpiTile[]
}

function buildKpis(stats: FleetPage['stats']): KpiData {
  const { total, online, offline, pending, maintenance: inMaint } = stats

  // Focus = lo accionable. Sin activar es priority 1, mantenimiento priority 2,
  // sino mostramos "Total" como referencia neutral.
  const focus: KpiTile =
    pending > 0
      ? {
          label: 'Sin activar',
          value: NUM.format(pending),
          footnote: 'Terminals registrados pero no han hecho su primer heartbeat',
          tone: 'actionable',
        }
      : inMaint > 0
        ? {
            label: 'En mantenimiento',
            value: NUM.format(inMaint),
            footnote: 'No están operando — revisar y reactivar',
            tone: 'actionable',
          }
        : {
            label: 'Total',
            value: NUM.format(total),
            tone: 'default',
          }

  return {
    focus,
    rest: [
      ...(focus.label === 'Total'
        ? []
        : [{ label: 'Total', value: NUM.format(total), tone: 'default' as const }]),
      { label: 'Online', value: NUM.format(online), tone: 'default' as const },
      ...(offline > 0
        ? [
            {
              label: 'Activas offline',
              value: NUM.format(offline),
              tone: 'actionable' as const,
            },
          ]
        : [{ label: 'Activas offline', value: NUM.format(offline), tone: 'default' as const }]),
    ].slice(0, 4),
  }
}

export function TerminalsPage() {
  const [statuses, setStatuses] = useState<Set<TerminalStatus>>(new Set())
  const [types, setTypes] = useState<Set<TerminalType>>(new Set())
  const [connection, setConnection] = useState<ConnectionOption>('all')
  const [groupBy, setGroupBy] = useState<GroupByOption>('none')

  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const params = {
    page,
    pageSize: 25,
    search: debouncedSearch || undefined,
    statuses: [...statuses].join(',') || undefined,
    types: [...types].join(',') || undefined,
    connection,
  }
  const query = useTerminals(params)
  const detail = useTerminalDetail(drawerId ?? undefined)
  const drawerTerminal = detail.data ?? query.data?.data.find((t) => t.id === drawerId) ?? null
  const drawerOpen = drawerId !== null
  const filtered = query.data?.data ?? []
  const kpis = query.data ? buildKpis(query.data.stats) : null
  const totalCount = query.data?.stats.total ?? 0
  const filteredCount = query.data?.total ?? 0
  const hasActiveFilters =
    statuses.size > 0 || types.size > 0 || connection !== 'all' || search !== ''
  const resetAllFilters = () => {
    setStatuses(new Set())
    setTypes(new Set())
    setConnection('all')
    setSearch('')
    setPage(1)
  }
  const changeSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const exportable = {
    filename: 'tpvs',
    total: filteredCount,
    loadRows: () => exportTpvFleet(params),
    columns: [
      { key: 'id', header: 'ID', accessor: (t) => t.id, defaultEnabled: true },
      {
        key: 'name',
        header: 'Nombre',
        accessor: (t) => t.name,
        defaultEnabled: true,
      },
      {
        key: 'serialNumber',
        header: 'Serial',
        accessor: (t) => t.serialNumber ?? '',
        defaultEnabled: true,
      },
      {
        key: 'type',
        header: 'Tipo',
        accessor: (t) => humanizeTerminalType(t.type),
        defaultEnabled: true,
      },
      {
        key: 'status',
        header: 'Estado',
        accessor: (t) => humanizeTerminalStatus(t.status),
        defaultEnabled: true,
      },
      {
        key: 'venue',
        header: 'Venue',
        accessor: (t) => t.venue.name,
        defaultEnabled: true,
      },
      { key: 'brand', header: 'Marca', accessor: (t) => t.brand ?? '' },
      { key: 'model', header: 'Modelo', accessor: (t) => t.model ?? '' },
      {
        key: 'version',
        header: 'Versión',
        accessor: (t) => t.version ?? '',
        defaultEnabled: true,
      },
      {
        key: 'lastHeartbeat',
        header: 'Último contacto',
        accessor: (t) => t.lastHeartbeat ?? '',
        defaultEnabled: true,
      },
      {
        key: 'activatedAt',
        header: 'Activada',
        accessor: (t) => t.activatedAt ?? '',
      },
      { key: 'ipAddress', header: 'IP', accessor: (t) => t.ipAddress ?? '' },
      {
        key: 'isLocked',
        header: 'Bloqueada',
        accessor: (t) => (t.isLocked ? 'Sí' : 'No'),
      },
    ],
  } satisfies NonNullable<Parameters<typeof DataTable<Terminal>>[0]['exportable']>

  const columns = useMemo<ColumnDef<Terminal, unknown>[]>(
    () =>
      (
        [
          {
            id: 'terminal',
            header: 'Terminal',
            accessorFn: (row) => `${row.name} ${row.serialNumber ?? ''} ${row.venue.name}`,
            cell: ({ row }) => (
              <button
                type="button"
                onClick={() => setDrawerId(row.original.id)}
                className="group block min-w-0 -my-1 -mx-1 w-full rounded-[4px] px-1 py-1 text-left transition-colors hover:bg-[var(--canvas-sunken)]"
              >
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13.5px] font-semibold text-[var(--ink)] group-hover:text-[var(--accent)]">
                    {row.original.name}
                  </p>
                  <ConnectionDot terminal={row.original} />
                </div>
                <p className="tabular mt-0.5 truncate font-mono text-[12px] text-[var(--ink-faint)]">
                  {row.original.serialNumber || 'Sin serial'}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--ink-muted)]">
                  {row.original.venue.name}
                </p>
              </button>
            ),
            meta: { headerClassName: 'min-w-[220px]' },
          },
          {
            id: 'status',
            header: 'Estado',
            accessorFn: (row) => row.status,
            cell: ({ row }) => (
              <div className="flex flex-col items-start gap-1">
                <Badge tone={TERMINAL_STATUS_TONE[row.original.status]}>
                  {humanizeTerminalStatus(row.original.status)}
                </Badge>
                {row.original.isLocked && <Badge tone="danger">Bloqueada</Badge>}
                {row.original.migration?.inProgress && <Badge tone="warn">Migrando</Badge>}
              </div>
            ),
            meta: { headerClassName: 'w-[150px]' },
          },
          {
            id: 'type',
            header: 'Tipo',
            accessorFn: (row) => row.type,
            cell: ({ row }) => (
              <div>
                <Badge tone={TERMINAL_TYPE_TONE[row.original.type]}>
                  {humanizeTerminalType(row.original.type)}
                </Badge>
                {(row.original.brand || row.original.model) && (
                  <p className="mt-1 text-[12px] text-[var(--ink-faint)]">
                    {[row.original.brand, row.original.model].filter(Boolean).join(' ')}
                  </p>
                )}
              </div>
            ),
            meta: { headerClassName: 'w-[150px]' },
          },
          {
            id: 'lastHeartbeat',
            header: 'Último contacto',
            accessorFn: (row) => (row.lastHeartbeat ? new Date(row.lastHeartbeat).getTime() : 0),
            cell: ({ row }) => {
              const t = row.original
              if (!t.lastHeartbeat) {
                return <span className="text-[11.5px] italic text-[var(--ink-faint)]">Nunca</span>
              }
              return (
                <div>
                  <p className="tabular text-[12.5px] text-[var(--ink)]">
                    {formatRelative(t.lastHeartbeat)}
                  </p>
                  <p className="tabular mt-0.5 text-[12px] text-[var(--ink-faint)]">
                    {formatDateTime(t.lastHeartbeat)}
                  </p>
                </div>
              )
            },
            sortingFn: 'basic',
            meta: { headerClassName: 'w-[160px]' },
          },
          {
            id: 'version',
            header: 'Versión',
            accessorFn: (row) => row.version ?? '',
            cell: ({ row }) => (
              <span className="tabular font-mono text-[12px] text-[var(--ink-muted)]">
                {row.original.version || '—'}
              </span>
            ),
            meta: { headerClassName: 'w-[110px]' },
          },
          {
            id: '__open',
            header: () => <span className="sr-only">Abrir</span>,
            enableSorting: false,
            cell: ({ row }) => (
              <IconButton
                size="sm"
                onClick={() => setDrawerId(row.original.id)}
                aria-label={`Abrir acciones de ${row.original.name}`}
              >
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </IconButton>
            ),
            meta: { headerClassName: 'w-[48px]' },
          },
        ] satisfies ColumnDef<Terminal, unknown>[]
      ).map((column) => ({ ...column, enableSorting: false })),
    [],
  )

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="eyebrow">Catálogo</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            TPVs
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Terminales de pago de la plataforma. Selecciona una TPV para consultar su estado y sus
            acciones.
            <span className="tabular ml-2 text-[var(--ink-faint)]">
              · zona base {timezoneShort(DEFAULT_TIMEZONE)} ·{' '}
              {query.dataUpdatedAt > 0 ? `${totalCount} TPVs registradas` : 'cargando…'}
            </span>
          </p>
          {query.dataUpdatedAt > 0 && (
            <p className="mt-1 text-[13px] text-[var(--ink-faint)]">
              Conexión a la última consulta:{' '}
              {formatDateTime(new Date(query.dataUpdatedAt).toISOString())}. Usa Actualizar para
              comprobarla de nuevo.
            </p>
          )}
        </div>
        <Link to="/terminals/new" className={buttonVariants({ size: 'lg', className: 'shrink-0' })}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Registrar terminal
        </Link>
      </header>

      {query.isError && (
        <QueryError
          className="mb-5"
          error={query.error}
          context="cargar TPVs"
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      {kpis && <KpiStrip data={kpis} />}

      {(() => {
        const toolbar = (
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              label="Estado"
              activeLabel={formatActiveLabel(statuses, STATUS_OPTIONS)}
              activeCount={statuses.size}
              onClear={() => {
                setStatuses(new Set())
                setPage(1)
              }}
            >
              <MultiSelectFilterContent
                title="Estado del terminal"
                options={STATUS_OPTIONS}
                selected={statuses}
                onApply={(value) => {
                  setStatuses(value)
                  setPage(1)
                }}
              />
            </FilterPill>
            <FilterPill
              label="Tipo"
              activeLabel={formatActiveLabel(types, TYPE_OPTIONS)}
              activeCount={types.size}
              onClear={() => {
                setTypes(new Set())
                setPage(1)
              }}
            >
              <MultiSelectFilterContent
                title="Tipo de terminal"
                options={TYPE_OPTIONS}
                selected={types}
                onApply={(value) => {
                  setTypes(value)
                  setPage(1)
                }}
              />
            </FilterPill>
            <FilterPill
              label="Conexión"
              activeLabel={connection === 'all' ? null : labelForConnection(connection)}
              onClear={
                connection !== 'all'
                  ? () => {
                      setConnection('all')
                      setPage(1)
                    }
                  : undefined
              }
            >
              <SingleSelectFilterContent
                title="Estado de conexión"
                options={CONNECTION_OPTIONS}
                selected={connection}
                onChange={(value) => {
                  setConnection(value)
                  setPage(1)
                }}
              />
            </FilterPill>
            <span aria-hidden className="mx-1 hidden h-5 w-px bg-[var(--line)] sm:inline-block" />
            <FilterPill
              label="Agrupar"
              activeLabel={groupBy === 'venue' ? 'Por venue' : null}
              onClear={groupBy !== 'none' ? () => setGroupBy('none') : undefined}
            >
              <SingleSelectFilterContent
                title="Agrupar TPVs por"
                options={GROUP_BY_OPTIONS}
                selected={groupBy}
                onChange={setGroupBy}
              />
            </FilterPill>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="ml-1 shrink-0 whitespace-nowrap text-[12px] font-medium text-[var(--ink-muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
              >
                Borrar filtros
              </button>
            )}
          </div>
        )

        if (groupBy === 'venue') {
          return (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <input
                  aria-label="Buscar TPVs"
                  value={search}
                  onChange={(e) => changeSearch(e.target.value)}
                  placeholder="Buscar por nombre, serial o venue…"
                  className="h-10 rounded-md border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm"
                />
                {toolbar}
                <ExportDialog data={filtered} {...exportable} />
                <p className="tabular text-[11.5px] text-[var(--ink-faint)]">
                  {filteredCount} TPVs · agrupadas por venue en esta página
                </p>
              </div>
              <TerminalsByVenueList
                terminals={filtered}
                onSelectTerminal={(t) => setDrawerId(t.id)}
              />
            </div>
          )
        }

        return (
          <DataTable
            data={filtered}
            columns={columns}
            searchPlaceholder="Buscar por nombre, serial o venue…"
            serverSearch={{ value: search, onChange: changeSearch }}
            caption={`Tabla de ${filteredCount} TPVs${hasActiveFilters ? ' filtradas' : ''}.`}
            toolbar={toolbar}
            emptyState={{
              title: hasActiveFilters
                ? 'Ningún terminal coincide con los filtros'
                : totalCount === 0 && !query.isLoading
                  ? 'Sin TPVs registradas'
                  : 'Cargando TPVs…',
              description: hasActiveFilters
                ? 'Ajusta los filtros arriba o limpia la selección.'
                : totalCount === 0 && !query.isLoading
                  ? 'Cuando registres tu primera terminal aparecerá aquí.'
                  : 'Esto debería tardar menos de un segundo.',
            }}
            exportable={exportable}
          />
        )
      })()}

      {query.data && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-sm text-[var(--ink-muted)]">
            {filteredCount} TPVs · Página {page} de {Math.max(1, Math.ceil(filteredCount / 25))}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page === 1 || query.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              disabled={page * 25 >= filteredCount || query.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
            <Button variant="ghost" disabled={query.isFetching} onClick={() => query.refetch()}>
              Actualizar
            </Button>
          </div>
        </div>
      )}

      <TerminalActionDrawer
        terminal={drawerTerminal}
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) setDrawerId(null)
        }}
      />
    </div>
  )
}

function labelForConnection(c: ConnectionOption): string {
  switch (c) {
    case 'online':
      return 'Solo online'
    case 'offline':
      return 'Solo offline'
    case 'pending':
      return 'Sin activar'
    default:
      return ''
  }
}

function ConnectionDot({ terminal }: { terminal: Terminal }) {
  if (canBeActivated(terminal)) {
    return (
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--warn)] shadow-[0_0_0_2px_var(--warn-faint)]"
        title="Sin activar"
      />
    )
  }
  const online = isTerminalOnline(terminal)
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
        online
          ? 'bg-[var(--success)] shadow-[0_0_0_2px_var(--success-faint)]'
          : 'bg-[var(--ink-faint)] shadow-[0_0_0_2px_var(--line)]',
      )}
      title={online ? 'Online' : 'Offline'}
    />
  )
}

function KpiStrip({ data }: { data: KpiData }) {
  const focusActionable = data.focus.tone === 'actionable'
  return (
    <section
      aria-label="Indicadores de TPVs"
      className="mb-8 flex flex-col gap-px overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--line)] sm:flex-row"
    >
      <article
        className={cn(
          'flex-[2] bg-[var(--canvas)] p-5',
          focusActionable && 'border-l-2 border-l-[var(--accent)]',
        )}
      >
        <p className="eyebrow flex items-center gap-1.5">
          <Cpu className="h-3 w-3 text-[var(--ink-faint)]" aria-hidden />
          {data.focus.label}
        </p>
        <p className="mt-2.5 font-display tabular text-[32px] font-semibold leading-none tracking-[-0.022em] text-[var(--ink)]">
          {data.focus.value}
        </p>
        {data.focus.footnote && (
          <p className="mt-3 text-[12px] text-[var(--ink-muted)]">{data.focus.footnote}</p>
        )}
      </article>
      {data.rest.map((kpi) => (
        <article
          key={kpi.label}
          className={cn(
            'flex-1 bg-[var(--canvas)] p-4',
            kpi.tone === 'actionable' && 'bg-[var(--warn-faint)]',
          )}
        >
          <p className="eyebrow">{kpi.label}</p>
          <p
            className={cn(
              'mt-2.5 font-display tabular text-[22px] font-semibold leading-none tracking-[-0.018em]',
              kpi.tone === 'actionable' ? 'text-[var(--warn)]' : 'text-[var(--ink)]',
            )}
          >
            {kpi.value}
          </p>
        </article>
      ))}
    </section>
  )
}
