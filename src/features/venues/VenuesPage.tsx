import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/data-table/DataTable'
import {
  FilterPill,
  MultiSelectFilterContent,
  SingleSelectFilterContent,
  type MultiSelectOption,
  type SingleSelectOption,
} from '@/shared/filters'
import { QueryError } from '@/shared/components/QueryError'
import { DEFAULT_TIMEZONE, formatDate, formatRelative, timezoneShort } from '@/shared/lib/datetime'
import { cn } from '@/shared/lib/utils'
import { useVenues } from './use-venues'
import {
  humanizeKycStatus,
  humanizeVenueStatus,
  isDemoVenue,
  KYC_PENDING_STATUSES,
  KYC_STATUS_TONE,
  ONBOARDING_STATUSES,
  OPERATIONAL_STATUSES,
  ownerFullName,
  SUSPENDED_STATUSES,
  VENUE_STATUS_TONE,
  type KycStatus,
  type Venue,
  type VenueStatus,
} from './types'

const MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})
const MXN_PRECISE = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
})
const NUM = new Intl.NumberFormat('es-MX')

const STATUS_OPTIONS: MultiSelectOption<VenueStatus>[] = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'ONBOARDING', label: 'En onboarding' },
  { value: 'PENDING_ACTIVATION', label: 'Esperando activación' },
  { value: 'SUSPENDED', label: 'Pausado' },
  { value: 'ADMIN_SUSPENDED', label: 'Suspendido por Avoqado' },
  { value: 'CLOSED', label: 'Cerrado' },
  { value: 'TRIAL', label: 'Trial' },
  { value: 'LIVE_DEMO', label: 'Demo público' },
]

type KycOption = KycStatus | 'NONE'

const KYC_OPTIONS: MultiSelectOption<KycOption>[] = [
  { value: 'PENDING_REVIEW', label: 'En cola' },
  { value: 'IN_REVIEW', label: 'En revisión' },
  { value: 'VERIFIED', label: 'Verificado' },
  { value: 'REJECTED', label: 'Rechazado' },
  { value: 'NOT_SUBMITTED', label: 'No enviado' },
  { value: 'NONE', label: 'Sin KYC' },
]

type ScopeOption = 'production' | 'with-demos'

const SCOPE_OPTIONS: SingleSelectOption<ScopeOption>[] = [
  {
    value: 'production',
    label: 'Solo producción',
    description: 'Oculta TRIAL y LIVE_DEMO',
  },
  {
    value: 'with-demos',
    label: 'Producción + demos',
    description: 'Incluye TRIAL y LIVE_DEMO en la lista',
  },
]

/**
 * Compone la etiqueta visible del pill activo: "Activo, Pausado" para 2,
 * "Activo, Pausado +1" para 3+. Mantiene el pill estrecho aunque el set
 * sea grande — el operador ya lo abrió para componerlo, sabe qué hay.
 */
function formatActiveLabel<V extends string>(
  selected: Set<V>,
  options: readonly MultiSelectOption<V>[],
): string | null {
  if (selected.size === 0) return null
  const labels = options.filter((o) => selected.has(o.value)).map((o) => o.label)
  if (labels.length === 0) return null
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return labels.join(', ')
  return `${labels[0]}, ${labels[1]} +${labels.length - 2}`
}

interface KpiTile {
  label: string
  value: string
  footnote?: string
}

function buildKpis(venues: Venue[]): KpiTile[] {
  // Producción = excluye LIVE_DEMO + TRIAL. El operador piensa en métricas
  // de la flota real; los demos son ruido si los contamos parejo.
  const production = venues.filter((v) => !isDemoVenue(v))
  const active = production.filter((v) => OPERATIONAL_STATUSES.includes(v.status)).length
  const onboarding = production.filter((v) => ONBOARDING_STATUSES.includes(v.status)).length
  const suspended = production.filter((v) => SUSPENDED_STATUSES.includes(v.status)).length
  const kycPending = production.filter(
    (v) => v.kycStatus !== null && KYC_PENDING_STATUSES.includes(v.kycStatus),
  ).length

  return [
    {
      label: 'Producción',
      value: NUM.format(production.length),
      footnote: `${venues.length - production.length} demos excluidos`,
    },
    {
      label: 'Activos',
      value: NUM.format(active),
      footnote: 'Recibiendo pagos hoy',
    },
    {
      label: 'En onboarding',
      value: NUM.format(onboarding),
      footnote: 'Onboarding + esperando activación',
    },
    {
      label: 'KYC en cola',
      value: NUM.format(kycPending),
      footnote: kycPending > 0 ? 'Requieren tu revisión' : 'Nada en cola',
    },
    {
      label: 'Suspendidos',
      value: NUM.format(suspended),
      footnote: 'Voluntarios + por Avoqado',
    },
  ]
}

export function VenuesPage() {
  const [statuses, setStatuses] = useState<Set<VenueStatus>>(new Set())
  const [kycs, setKycs] = useState<Set<KycOption>>(new Set())
  const [scope, setScope] = useState<ScopeOption>('production')

  // El scope se manda al servidor — Render filtra los demos. El resto
  // (Estado + KYC) lo aplica el cliente porque ya tenemos el array entero
  // en memoria (no hay paginación server-side todavía).
  const includeDemos = scope === 'with-demos'
  const query = useVenues({ includeDemos })

  const filteredVenues = useMemo(() => {
    let venues = query.data ?? []
    if (statuses.size > 0) venues = venues.filter((v) => statuses.has(v.status))
    if (kycs.size > 0) {
      venues = venues.filter((v) => {
        const key: KycOption = v.kycStatus ?? 'NONE'
        return kycs.has(key)
      })
    }
    return venues
  }, [query.data, statuses, kycs])

  const kpis = useMemo(() => (query.data ? buildKpis(query.data) : null), [query.data])

  const columns = useMemo<ColumnDef<Venue, unknown>[]>(
    () => [
      {
        id: 'venue',
        header: 'Venue',
        accessorFn: (row) => `${row.name} ${row.slug} ${row.organization.name}`,
        cell: ({ row }) => (
          <Link
            to={`/venues/${row.original.id}`}
            className="group block min-w-0 -my-1 -mx-1 rounded-[4px] px-1 py-1 transition-colors hover:bg-[var(--canvas-sunken)]"
          >
            <p className="truncate text-[13.5px] font-semibold text-[var(--ink)] group-hover:text-[var(--accent)]">
              {row.original.name}
            </p>
            <p className="tabular mt-0.5 truncate font-mono text-[10.5px] text-[var(--ink-faint)]">
              {row.original.slug}
            </p>
            <p className="mt-1 truncate text-[11.5px] text-[var(--ink-muted)]">
              {row.original.organization.name}
            </p>
          </Link>
        ),
        meta: { headerClassName: 'min-w-[220px]' },
      },
      {
        id: 'status',
        header: 'Estado',
        accessorFn: (row) => row.status,
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <Badge tone={VENUE_STATUS_TONE[row.original.status]}>
              {humanizeVenueStatus(row.original.status)}
            </Badge>
            {row.original.kycStatus ? (
              <Badge tone={KYC_STATUS_TONE[row.original.kycStatus]}>
                KYC · {humanizeKycStatus(row.original.kycStatus)}
              </Badge>
            ) : (
              <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
                Sin KYC
              </span>
            )}
          </div>
        ),
        meta: { headerClassName: 'w-[180px]' },
      },
      {
        id: 'monthlyRevenue',
        header: () => <span className="block text-right">Volumen mes</span>,
        accessorFn: (row) => row.monthlyRevenue,
        cell: ({ row }) => {
          const value = row.original.monthlyRevenue
          const tx = row.original.monthlyTransactions
          if (tx === 0) {
            return <span className="block text-right text-[11.5px] text-[var(--ink-faint)]">—</span>
          }
          return (
            <div className="text-right">
              <p className="tabular text-[13px] font-semibold text-[var(--ink)]">
                {MXN.format(value)}
              </p>
              <p className="tabular mt-0.5 text-[10.5px] text-[var(--ink-faint)]">
                {NUM.format(tx)} {tx === 1 ? 'pago' : 'pagos'}
              </p>
            </div>
          )
        },
        sortingFn: 'basic',
        meta: { headerClassName: 'w-[140px]' },
      },
      {
        id: 'aov',
        header: () => <span className="block text-right">AOV</span>,
        accessorFn: (row) => row.averageOrderValue,
        cell: ({ row }) => {
          const aov = row.original.averageOrderValue
          if (aov <= 0) {
            return <span className="block text-right text-[11.5px] text-[var(--ink-faint)]">—</span>
          }
          return (
            <p className="tabular text-right text-[12.5px] text-[var(--ink-muted)]">
              {MXN_PRECISE.format(aov)}
            </p>
          )
        },
        sortingFn: 'basic',
        meta: { headerClassName: 'w-[110px]' },
      },
      {
        id: 'owner',
        header: 'Owner',
        accessorFn: (row) => ownerFullName(row.owner),
        cell: ({ row }) => {
          const name = ownerFullName(row.original.owner)
          return (
            <div className="min-w-0">
              <p className="truncate text-[12.5px] text-[var(--ink)]">{name}</p>
              <p className="truncate text-[10.5px] text-[var(--ink-faint)]">
                {row.original.owner.email}
              </p>
            </div>
          )
        },
        meta: { headerClassName: 'min-w-[180px]' },
      },
      {
        id: 'createdAt',
        header: `Creado (${timezoneShort(DEFAULT_TIMEZONE)})`,
        accessorFn: (row) => new Date(row.createdAt).getTime(),
        cell: ({ row }) => (
          <div>
            <p className="tabular text-[12.5px] text-[var(--ink)]">
              {formatRelative(row.original.createdAt)}
            </p>
            <p className="tabular mt-0.5 text-[10.5px] text-[var(--ink-faint)]">
              {formatDate(row.original.createdAt)}
            </p>
          </div>
        ),
        sortingFn: 'basic',
        meta: { headerClassName: 'w-[140px]' },
      },
      {
        id: '__open',
        header: () => <span className="sr-only">Abrir</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to={`/venues/${row.original.id}`}
            aria-label={`Ver detalle de ${row.original.name}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[var(--ink-faint)] transition-colors hover:bg-[var(--canvas-sunken)] hover:text-[var(--ink)]"
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ),
        meta: { headerClassName: 'w-[48px]' },
      },
    ],
    [],
  )

  const totalCount = query.data?.length ?? 0
  const filteredCount = filteredVenues.length
  const hasActiveFilters = statuses.size > 0 || kycs.size > 0 || scope !== 'production'

  const resetAllFilters = () => {
    setStatuses(new Set())
    setKycs(new Set())
    setScope('production')
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            Venues
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            La flota de Avoqado en una sola tabla. Activos, en onboarding, suspendidos, demos.
            <span className="tabular ml-2 text-[var(--ink-faint)]">
              · zona base {timezoneShort(DEFAULT_TIMEZONE)} ·{' '}
              {query.dataUpdatedAt > 0 ? `${totalCount} venues cargados` : 'cargando…'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="md" disabled title="Próximamente">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Nuevo venue
          </Button>
        </div>
      </header>

      {query.isError && (
        <QueryError
          className="mb-5"
          error={query.error}
          context="cargar venues"
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      <section
        aria-label="Indicadores de venues"
        className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--line)] sm:grid-cols-3 lg:grid-cols-5"
      >
        {(kpis ?? skeletonKpis()).map((kpi, idx) => (
          <article key={kpi.label || idx} className="bg-[var(--canvas)] p-4">
            <p className="eyebrow">{kpi.label}</p>
            <p className="mt-3 font-display tabular text-[24px] font-semibold leading-none tracking-[-0.02em] text-[var(--ink)]">
              {kpis ? kpi.value : <span className="opacity-30">—</span>}
            </p>
            {kpi.footnote && (
              <p className="mt-3 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--ink-faint)]">
                {kpi.footnote}
              </p>
            )}
          </article>
        ))}
      </section>

      <DataTable
        data={filteredVenues}
        columns={columns}
        searchPlaceholder="Buscar por nombre, slug u organización…"
        caption={`Tabla de ${filteredCount} venues${hasActiveFilters ? ' filtrados' : ''}.`}
        initialSorting={[{ id: 'createdAt', desc: true }]}
        pageSize={25}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              label="Estado"
              activeLabel={formatActiveLabel(statuses, STATUS_OPTIONS)}
              activeCount={statuses.size}
              onClear={() => setStatuses(new Set())}
            >
              <MultiSelectFilterContent
                title="Estado del venue"
                options={STATUS_OPTIONS}
                selected={statuses}
                onApply={setStatuses}
              />
            </FilterPill>
            <FilterPill
              label="KYC"
              activeLabel={formatActiveLabel(kycs, KYC_OPTIONS)}
              activeCount={kycs.size}
              onClear={() => setKycs(new Set())}
            >
              <MultiSelectFilterContent
                title="Estado de KYC"
                options={KYC_OPTIONS}
                selected={kycs}
                onApply={setKycs}
              />
            </FilterPill>
            <FilterPill
              label="Vista"
              activeLabel={scope === 'with-demos' ? 'Incluye demos' : null}
              onClear={scope !== 'production' ? () => setScope('production') : undefined}
            >
              <SingleSelectFilterContent
                title="Alcance de la lista"
                options={SCOPE_OPTIONS}
                selected={scope}
                onChange={setScope}
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
          </div>
        }
        emptyState={{
          title: hasActiveFilters
            ? 'Ningún venue coincide con los filtros'
            : totalCount === 0 && !query.isLoading
              ? 'Sin venues registrados'
              : 'Cargando venues…',
          description: hasActiveFilters
            ? 'Ajusta los filtros arriba o limpia la selección con "Todo".'
            : totalCount === 0 && !query.isLoading
              ? 'Cuando se cree el primer venue real (no demo), aparecerá aquí.'
              : 'Esto debería tardar menos de un segundo.',
        }}
        exportable={{
          filename: 'venues',
          columns: [
            { key: 'id', header: 'ID', accessor: (v) => v.id, defaultEnabled: true },
            { key: 'name', header: 'Nombre', accessor: (v) => v.name, defaultEnabled: true },
            { key: 'slug', header: 'Slug', accessor: (v) => v.slug, defaultEnabled: true },
            {
              key: 'status',
              header: 'Estado',
              accessor: (v) => humanizeVenueStatus(v.status),
              defaultEnabled: true,
            },
            {
              key: 'kycStatus',
              header: 'KYC',
              accessor: (v) => humanizeKycStatus(v.kycStatus),
              defaultEnabled: true,
            },
            {
              key: 'organization',
              header: 'Organización',
              accessor: (v) => v.organization.name,
              defaultEnabled: true,
            },
            {
              key: 'organizationEmail',
              header: 'Email org',
              accessor: (v) => v.organization.email,
            },
            {
              key: 'owner',
              header: 'Owner',
              accessor: (v) => ownerFullName(v.owner),
              defaultEnabled: true,
            },
            { key: 'ownerEmail', header: 'Email owner', accessor: (v) => v.owner.email },
            {
              key: 'monthlyRevenue',
              header: 'Volumen mes (MXN)',
              accessor: (v) => v.monthlyRevenue,
              defaultEnabled: true,
            },
            {
              key: 'monthlyTransactions',
              header: 'Pagos mes',
              accessor: (v) => v.monthlyTransactions,
              defaultEnabled: true,
            },
            {
              key: 'averageOrderValue',
              header: 'AOV (MXN)',
              accessor: (v) => v.averageOrderValue,
            },
            {
              key: 'createdAt',
              header: 'Creado',
              accessor: (v) => v.createdAt,
              defaultEnabled: true,
            },
            { key: 'statusChangedAt', header: 'Último cambio', accessor: (v) => v.statusChangedAt },
            {
              key: 'suspensionReason',
              header: 'Razón suspensión',
              accessor: (v) => v.suspensionReason,
            },
          ],
          dateAccessor: (v) => v.createdAt,
        }}
      />

      <p className={cn('mt-3 text-[11.5px] text-[var(--ink-faint)]')}>
        Las métricas de volumen, pagos y AOV se calculan sobre el mes en curso (Mexico City).
        Algunos campos del backend (plan, comisión, features) están pendientes de migración a datos
        reales — se mostrarán cuando estén listos.
      </p>
    </div>
  )
}

function skeletonKpis(): KpiTile[] {
  return [
    { label: 'Producción', value: '—' },
    { label: 'Activos', value: '—' },
    { label: 'En onboarding', value: '—' },
    { label: 'KYC en cola', value: '—' },
    { label: 'Suspendidos', value: '—' },
  ]
}
