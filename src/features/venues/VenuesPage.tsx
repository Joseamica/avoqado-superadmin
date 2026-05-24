import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/shared/ui/Badge'
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
import { DEFAULT_TIMEZONE, formatDate, formatRelative, timezoneShort } from '@/shared/lib/datetime'
import { cn } from '@/shared/lib/utils'
import { useVenues } from './use-venues'
import { SetupIcons } from './SetupIcons'
import { VenuesByOrgList } from './VenuesByOrgList'
import {
  humanizeKycStatus,
  humanizeVenueStatus,
  inspectOwner,
  isDemoVenue,
  KYC_PENDING_STATUSES,
  KYC_STATUS_TONE,
  ONBOARDING_STATUSES,
  OPERATIONAL_STATUSES,
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

type GroupByOption = 'none' | 'organization'

const GROUP_BY_OPTIONS: SingleSelectOption<GroupByOption>[] = [
  {
    value: 'none',
    label: 'Sin agrupar',
    description: 'Lista plana con sort, search y export',
  },
  {
    value: 'organization',
    label: 'Por organización',
    description: 'Secciones por org con totales agregados — sin export ni search',
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

/**
 * Una KPI tile. `tone` define peso visual — la `actionable` ocupa más ancho
 * y queda con border-l accent (es la que el operador DEBE mirar primero).
 * Las `default` son referencia, no urgencia.
 */
interface KpiTile {
  label: string
  value: string
  /** Footnote sólo cuando hay STORY que contar — no decoración. */
  footnote?: string
  /** "actionable" = requiere atención del operador; "default" = informativo. */
  tone: 'actionable' | 'default'
}

interface KpiData {
  /** El que el operador debería mirar primero. Único, ocupa 2 cols. */
  focus: KpiTile
  /** El resto, peso visual uniforme. */
  rest: KpiTile[]
}

function buildKpis(venues: Venue[]): KpiData {
  // Producción = excluye LIVE_DEMO + TRIAL. El operador piensa en métricas
  // de la flota real; los demos son ruido si los contamos parejo.
  const production = venues.filter((v) => !isDemoVenue(v))
  const active = production.filter((v) => OPERATIONAL_STATUSES.includes(v.status)).length
  const onboarding = production.filter((v) => ONBOARDING_STATUSES.includes(v.status)).length
  const suspendedVoluntary = production.filter((v) => v.status === 'SUSPENDED').length
  const suspendedAdmin = production.filter((v) => v.status === 'ADMIN_SUSPENDED').length
  const kycPending = production.filter(
    (v) => v.kycStatus !== null && KYC_PENDING_STATUSES.includes(v.kycStatus),
  ).length

  // El "focus" se elige por urgencia: KYC en cola > Onboarding > Total.
  // Sólo el focus tiene footnote — los demás son datos, no story.
  const focus: KpiTile =
    kycPending > 0
      ? {
          label: 'KYC en cola',
          value: NUM.format(kycPending),
          footnote: 'Requieren revisión del superadmin',
          tone: 'actionable',
        }
      : onboarding > 0
        ? {
            label: 'En onboarding',
            value: NUM.format(onboarding),
            footnote: 'Pendientes de activación',
            tone: 'actionable',
          }
        : {
            label: 'Total producción',
            value: NUM.format(production.length),
            tone: 'default',
          }

  return {
    focus,
    rest: [
      // Si el focus no es ya "total", lo agregamos aquí como referencia.
      ...(focus.label === 'Total producción'
        ? []
        : [{ label: 'Total', value: NUM.format(production.length), tone: 'default' as const }]),
      { label: 'Activos', value: NUM.format(active), tone: 'default' as const },
      // Separamos voluntary vs admin — son operacionalmente distintos.
      // ADMIN_SUSPENDED es alarma; SUSPENDED voluntario no.
      ...(suspendedAdmin > 0
        ? [
            {
              label: 'Susp. por Avoqado',
              value: NUM.format(suspendedAdmin),
              tone: 'actionable' as const,
            },
          ]
        : []),
      { label: 'Pausados', value: NUM.format(suspendedVoluntary), tone: 'default' as const },
    ].slice(0, 4),
  }
}

export function VenuesPage() {
  const [statuses, setStatuses] = useState<Set<VenueStatus>>(new Set())
  const [kycs, setKycs] = useState<Set<KycOption>>(new Set())
  const [scope, setScope] = useState<ScopeOption>('production')
  // `groupBy` es una preferencia de VISTA, no un filtro — por eso vive
  // separado de `resetAllFilters()`. Limpiar filtros mantiene la vista
  // agrupada si el operador la había elegido.
  const [groupBy, setGroupBy] = useState<GroupByOption>('none')

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
        cell: ({ row }) => {
          const kyc = row.original.kycStatus
          // Sólo mostramos el KYC pill cuando NO está verificado — es decir,
          // cuando el operador necesita actuar (rechazado, en revisión, sin
          // enviar, o ausente). Mostrarlo "KYC · VERIFICADO" en cada row es
          // ruido visual; `data, not decoration` (.impeccable.md).
          const showKycPill = kyc !== 'VERIFIED'
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge tone={VENUE_STATUS_TONE[row.original.status]}>
                {humanizeVenueStatus(row.original.status)}
              </Badge>
              {showKycPill &&
                (kyc ? (
                  <Badge tone={KYC_STATUS_TONE[kyc]}>KYC · {humanizeKycStatus(kyc)}</Badge>
                ) : (
                  <Badge tone="muted">Sin KYC</Badge>
                ))}
            </div>
          )
        },
        meta: { headerClassName: 'w-[160px]' },
      },
      {
        id: 'setup',
        header: 'Setup',
        // Accessor para sort: cuenta de flags `true`. Permite ordenar la
        // tabla por "más / menos completos" — útil para spot venues que
        // necesitan atención.
        accessorFn: (row) => {
          const c = row.completeness
          if (!c) return -1 // unknown queda al final
          return [
            c.hasOwner,
            c.kycVerified,
            c.hasTerminal,
            c.hasMerchantAccount,
            c.hasPricing,
          ].filter(Boolean).length
        },
        cell: ({ row }) => <SetupIcons venue={row.original} />,
        sortingFn: 'basic',
        meta: { headerClassName: 'w-[200px]' },
      },
      {
        id: 'monthlyRevenue',
        header: () => <span className="block text-right">Volumen</span>,
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
        // El accessor para sort/search usa el nombre real, o un string
        // estable cuando no hay owner — así "Sin owner" agrupa al ordenar
        // alfabéticamente en lugar de scatter el placeholder.
        accessorFn: (row) => {
          const status = inspectOwner(row.owner)
          return status.kind === 'real' ? status.name : '~sin-owner'
        },
        cell: ({ row }) => {
          const status = inspectOwner(row.original.owner)
          if (status.kind === 'missing') {
            return (
              <div className="min-w-0">
                <p className="text-[12.5px] italic text-[var(--ink-faint)]">Sin owner</p>
                <p className="text-[10.5px] text-[var(--ink-faint)]">
                  {status.reason === 'synthetic-email' ? 'Cuenta de sistema' : 'Falta Staff ADMIN'}
                </p>
              </div>
            )
          }
          return (
            <div className="min-w-0">
              <p className="truncate text-[12.5px] text-[var(--ink)]">{status.name}</p>
              <p className="truncate text-[10.5px] text-[var(--ink-faint)]">{status.email}</p>
            </div>
          )
        },
        meta: { headerClassName: 'min-w-[180px]' },
      },
      {
        id: 'createdAt',
        // El TZ ya está indicado en el subtítulo de la página — repetirlo en
        // cada header genera wrapping a 2 líneas en columnas angostas.
        header: 'Creado',
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
        <div className="min-w-0">
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
        <Link to="/venues/new" className={buttonVariants({ size: 'lg', className: 'shrink-0' })}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Nuevo venue
        </Link>
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

      {kpis && <KpiStrip data={kpis} />}

      {/*
        Toolbar de filtros + groupBy. Vive fuera del DataTable porque también
        debe acompañar la vista agrupada (donde no renderizamos DataTable).
        En vista plana se pasa al slot `toolbar=` del DataTable; en agrupada
        se renderiza arriba del listado custom.
      */}
      {(() => {
        const toolbar = (
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
            <span aria-hidden className="mx-1 hidden h-5 w-px bg-[var(--line)] sm:inline-block" />
            <FilterPill
              label="Agrupar"
              activeLabel={groupBy === 'organization' ? 'Por organización' : null}
              onClear={groupBy !== 'none' ? () => setGroupBy('none') : undefined}
            >
              <SingleSelectFilterContent
                title="Agrupar venues por"
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

        if (groupBy === 'organization') {
          return (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {toolbar}
                <p className="tabular text-[11.5px] text-[var(--ink-faint)]">
                  {filteredCount} venues · agrupados por organización
                </p>
              </div>
              <VenuesByOrgList venues={filteredVenues} />
            </div>
          )
        }

        return (
          <DataTable
            data={filteredVenues}
            columns={columns}
            searchPlaceholder="Buscar por nombre, slug u organización…"
            caption={`Tabla de ${filteredCount} venues${hasActiveFilters ? ' filtrados' : ''}.`}
            initialSorting={[{ id: 'createdAt', desc: true }]}
            pageSize={25}
            toolbar={toolbar}
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
                  // En el CSV mantenemos el dato crudo si es real, pero
                  // normalizamos placeholders a vacío para que el operador no
                  // pegue "Unknown Owner" en un correo accidental.
                  accessor: (v) => {
                    const status = inspectOwner(v.owner)
                    return status.kind === 'real' ? status.name : ''
                  },
                  defaultEnabled: true,
                },
                {
                  key: 'ownerEmail',
                  header: 'Email owner',
                  accessor: (v) => {
                    const status = inspectOwner(v.owner)
                    return status.kind === 'real' ? status.email : ''
                  },
                },
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
                {
                  key: 'statusChangedAt',
                  header: 'Último cambio',
                  accessor: (v) => v.statusChangedAt,
                },
                {
                  key: 'suspensionReason',
                  header: 'Razón suspensión',
                  accessor: (v) => v.suspensionReason,
                },
              ],
              dateAccessor: (v) => v.createdAt,
            }}
          />
        )
      })()}
    </div>
  )
}

/**
 * KPI strip con jerarquía asimétrica.
 *
 * El KPI `focus` ocupa más ancho (col-span-2) y trae footnote — es la
 * historia que el operador debe leer al entrar a la página. Los `rest`
 * son referencias secundarias sin footnote — números puros que el
 * operador 6h/día ya conoce de memoria.
 *
 * Cuando el focus es `actionable` (KYC en cola, ADMIN_SUSPENDED, etc.),
 * el tile recibe un border-l accent que llama la atención sin gritar.
 */
function KpiStrip({ data }: { data: KpiData }) {
  const focusActionable = data.focus.tone === 'actionable'
  return (
    <section
      aria-label="Indicadores de venues"
      // Flex en vez de grid fijo de 5 cols — el `rest.length` varía entre 2-4
      // dependiendo del estado (si hay ADMIN_SUSPENDED arriba de 0, si el focus
      // es Total vs KYC en cola, etc.). Grid-cols-5 dejaba slots vacíos grises;
      // flex con `flex-[2]` y `flex-1` se adapta sin huecos.
      className="mb-8 flex flex-col gap-px overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--line)] sm:flex-row"
    >
      <article
        className={cn(
          'flex-[2] bg-[var(--canvas)] p-5',
          // Border-l accent SÓLO cuando el focus es accionable. Si todo
          // está tranquilo, se ve neutral — no inflamamos urgencia falsa.
          focusActionable && 'border-l-2 border-l-[var(--accent)]',
        )}
      >
        <p className="eyebrow">{data.focus.label}</p>
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
            // Tiles secundarios que también son accionables (ej. Susp. por
            // Avoqado > 0) reciben acento sutil — sin footnote, sin border-l.
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
