import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Package } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/shared/ui/Badge'
import { IconButton } from '@/shared/ui/IconButton'
import { DataTable } from '@/shared/data-table/DataTable'
import { FilterPill, MultiSelectFilterContent, type MultiSelectOption } from '@/shared/filters'
import { QueryError } from '@/shared/components/QueryError'
import { DEFAULT_TIMEZONE, formatDateTime, timezoneShort } from '@/shared/lib/datetime'
import { cn } from '@/shared/lib/utils'
import { useTpvOrders } from './use-tpv-orders'
import {
  FULFILLMENT_STATUS_TONE,
  PAYMENT_METHOD_TONE,
  PAYMENT_STATUS_TONE,
  formatMxnCents,
  humanizeFulfillmentStatus,
  humanizePaymentMethod,
  humanizePaymentStatus,
  needsSerialsAssignment,
  totalUnits,
  type TerminalOrder,
  type TerminalOrderFulfillmentStatus,
  type TerminalOrderPaymentMethod,
  type TerminalOrderPaymentStatus,
} from './types'

const NUM = new Intl.NumberFormat('es-MX')

const PAYMENT_STATUS_OPTIONS: MultiSelectOption<TerminalOrderPaymentStatus>[] = [
  { value: 'AWAITING_PAYMENT', label: 'Esperando pago' },
  { value: 'AWAITING_PROOF', label: 'Esperando comprobante' },
  { value: 'PROOF_UPLOADED', label: 'Comprobante subido' },
  { value: 'PAID', label: 'Pagado' },
  { value: 'REJECTED', label: 'Rechazado' },
  { value: 'EXPIRED', label: 'Expirado' },
  { value: 'REFUNDED', label: 'Reembolsado' },
]

const FULFILLMENT_STATUS_OPTIONS: MultiSelectOption<TerminalOrderFulfillmentStatus>[] = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'AWAITING_SERIALS', label: 'Asignar serials' },
  { value: 'SERIALS_ASSIGNED', label: 'Serials asignados' },
  { value: 'SHIPPED', label: 'Enviado' },
  { value: 'DELIVERED', label: 'Entregado' },
  { value: 'CANCELLED', label: 'Cancelado' },
]

const PAYMENT_METHOD_OPTIONS: MultiSelectOption<TerminalOrderPaymentMethod>[] = [
  { value: 'CARD_STRIPE', label: 'Tarjeta' },
  { value: 'SPEI', label: 'SPEI' },
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

function buildKpis(orders: TerminalOrder[]): KpiData {
  const total = orders.length
  const awaitingPayment = orders.filter(
    (o) => o.paymentStatus === 'AWAITING_PAYMENT' || o.paymentStatus === 'AWAITING_PROOF',
  ).length
  const proofUploaded = orders.filter((o) => o.paymentStatus === 'PROOF_UPLOADED').length
  const awaitingSerials = orders.filter((o) => needsSerialsAssignment(o)).length
  const paid = orders.filter((o) => o.paymentStatus === 'PAID').length

  // Prioridad operativa: PROOF_UPLOADED > AWAITING_SERIALS > otras.
  // PROOF_UPLOADED requiere revisar el comprobante; AWAITING_SERIALS espera al sales.
  const focus: KpiTile =
    proofUploaded > 0
      ? {
          label: 'Comprobantes por revisar',
          value: NUM.format(proofUploaded),
          footnote: 'Pedidos SPEI con comprobante subido. Revisa y aprueba o rechaza.',
          tone: 'actionable',
        }
      : awaitingSerials > 0
        ? {
            label: 'Asignar serials',
            value: NUM.format(awaitingSerials),
            footnote: 'Pedidos pagados que esperan asignación de serials por el sales.',
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
      { label: 'Pagados', value: NUM.format(paid), tone: 'default' as const },
      { label: 'Esperando pago', value: NUM.format(awaitingPayment), tone: 'default' as const },
    ].slice(0, 3),
  }
}

export function TpvOrdersPage() {
  const [paymentStatuses, setPaymentStatuses] = useState<Set<TerminalOrderPaymentStatus>>(new Set())
  const [fulfillmentStatuses, setFulfillmentStatuses] = useState<
    Set<TerminalOrderFulfillmentStatus>
  >(new Set())
  const [paymentMethods, setPaymentMethods] = useState<Set<TerminalOrderPaymentMethod>>(new Set())

  const query = useTpvOrders()

  const filtered = useMemo(() => {
    let list = query.data ?? []
    if (paymentStatuses.size > 0) list = list.filter((o) => paymentStatuses.has(o.paymentStatus))
    if (fulfillmentStatuses.size > 0)
      list = list.filter((o) => fulfillmentStatuses.has(o.fulfillmentStatus))
    if (paymentMethods.size > 0) list = list.filter((o) => paymentMethods.has(o.paymentMethod))
    return list
  }, [query.data, paymentStatuses, fulfillmentStatuses, paymentMethods])

  const kpis = useMemo(() => (query.data ? buildKpis(query.data) : null), [query.data])
  const totalCount = query.data?.length ?? 0
  const filteredCount = filtered.length
  const hasActiveFilters =
    paymentStatuses.size > 0 || fulfillmentStatuses.size > 0 || paymentMethods.size > 0
  const resetAllFilters = () => {
    setPaymentStatuses(new Set())
    setFulfillmentStatuses(new Set())
    setPaymentMethods(new Set())
  }

  const columns = useMemo<ColumnDef<TerminalOrder, unknown>[]>(
    () => [
      {
        id: 'order',
        header: 'Pedido',
        accessorFn: (row) =>
          `${row.orderNumber} ${row.venue.name} ${row.contactName} ${row.contactEmail}`,
        cell: ({ row }) => (
          <Link
            to={`/tpv-orders/${row.original.id}`}
            className="group block min-w-0 -my-1 -mx-1 rounded-[4px] px-1 py-1 text-left transition-colors hover:bg-[var(--canvas-sunken)]"
          >
            <p className="tabular truncate font-mono text-[12.5px] font-semibold text-[var(--ink)] group-hover:text-[var(--accent)]">
              {row.original.orderNumber}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-[var(--ink-muted)]">
              {row.original.venue.name}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--ink-faint)]">
              {row.original.contactName} · {row.original.contactEmail}
            </p>
          </Link>
        ),
        meta: { headerClassName: 'min-w-[260px]' },
      },
      {
        id: 'items',
        header: 'Unidades',
        accessorFn: (row) => totalUnits(row),
        cell: ({ row }) => (
          <span className="tabular text-[12.5px] text-[var(--ink)]">
            {NUM.format(totalUnits(row.original))}
          </span>
        ),
        meta: { headerClassName: 'w-[90px]' },
      },
      {
        id: 'total',
        header: 'Total',
        accessorFn: (row) => row.totalCents,
        cell: ({ row }) => (
          <span className="tabular text-right text-[12.5px] font-medium text-[var(--ink)]">
            {formatMxnCents(row.original.totalCents, row.original.currency)}
          </span>
        ),
        meta: { headerClassName: 'w-[140px] text-right' },
      },
      {
        id: 'paymentMethod',
        header: 'Método',
        accessorFn: (row) => row.paymentMethod,
        cell: ({ row }) => (
          <Badge tone={PAYMENT_METHOD_TONE[row.original.paymentMethod]}>
            {humanizePaymentMethod(row.original.paymentMethod)}
          </Badge>
        ),
        meta: { headerClassName: 'w-[100px]' },
      },
      {
        id: 'paymentStatus',
        header: 'Pago',
        accessorFn: (row) => row.paymentStatus,
        cell: ({ row }) => (
          <Badge tone={PAYMENT_STATUS_TONE[row.original.paymentStatus]}>
            {humanizePaymentStatus(row.original.paymentStatus)}
          </Badge>
        ),
        meta: { headerClassName: 'w-[160px]' },
      },
      {
        id: 'fulfillmentStatus',
        header: 'Fulfillment',
        accessorFn: (row) => row.fulfillmentStatus,
        cell: ({ row }) => (
          <Badge tone={FULFILLMENT_STATUS_TONE[row.original.fulfillmentStatus]}>
            {humanizeFulfillmentStatus(row.original.fulfillmentStatus)}
          </Badge>
        ),
        meta: { headerClassName: 'w-[160px]' },
      },
      {
        id: 'createdAt',
        header: `Creado (${timezoneShort(DEFAULT_TIMEZONE)})`,
        accessorFn: (row) => new Date(row.createdAt).getTime(),
        cell: ({ row }) => (
          <span className="tabular text-[12px] text-[var(--ink-muted)]">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
        sortingFn: 'basic',
        meta: { headerClassName: 'w-[170px]' },
      },
      {
        id: '__open',
        header: () => <span className="sr-only">Abrir</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to={`/tpv-orders/${row.original.id}`}
            aria-label={`Abrir pedido ${row.original.orderNumber}`}
          >
            <IconButton size="sm" aria-label={`Abrir pedido ${row.original.orderNumber}`}>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </IconButton>
          </Link>
        ),
        meta: { headerClassName: 'w-[48px]' },
      },
    ],
    [],
  )

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="eyebrow">Operación</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            Pedidos TPV
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Hardware (TPVs PAX, impresoras, KDS) que los venues compran a Avoqado. Click en un
            pedido para revisar el comprobante, asignar serials, o marcar el envío.
            <span className="tabular ml-2 text-[var(--ink-faint)]">
              · zona base {timezoneShort(DEFAULT_TIMEZONE)} ·{' '}
              {query.dataUpdatedAt > 0 ? `${totalCount} pedidos cargados` : 'cargando…'}
            </span>
          </p>
        </div>
      </header>

      {query.isError && (
        <QueryError
          className="mb-5"
          error={query.error}
          context="cargar pedidos TPV"
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      {kpis && <KpiStrip data={kpis} />}

      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder="Buscar por # pedido, venue, contacto…"
        caption={`Tabla de ${filteredCount} pedidos TPV${hasActiveFilters ? ' filtrados' : ''}.`}
        initialSorting={[{ id: 'createdAt', desc: true }]}
        pageSize={25}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              label="Pago"
              activeLabel={formatActiveLabel(paymentStatuses, PAYMENT_STATUS_OPTIONS)}
              activeCount={paymentStatuses.size}
              onClear={() => setPaymentStatuses(new Set())}
            >
              <MultiSelectFilterContent
                title="Estado de pago"
                options={PAYMENT_STATUS_OPTIONS}
                selected={paymentStatuses}
                onApply={setPaymentStatuses}
              />
            </FilterPill>
            <FilterPill
              label="Fulfillment"
              activeLabel={formatActiveLabel(fulfillmentStatuses, FULFILLMENT_STATUS_OPTIONS)}
              activeCount={fulfillmentStatuses.size}
              onClear={() => setFulfillmentStatuses(new Set())}
            >
              <MultiSelectFilterContent
                title="Estado de fulfillment"
                options={FULFILLMENT_STATUS_OPTIONS}
                selected={fulfillmentStatuses}
                onApply={setFulfillmentStatuses}
              />
            </FilterPill>
            <FilterPill
              label="Método"
              activeLabel={formatActiveLabel(paymentMethods, PAYMENT_METHOD_OPTIONS)}
              activeCount={paymentMethods.size}
              onClear={() => setPaymentMethods(new Set())}
            >
              <MultiSelectFilterContent
                title="Método de pago"
                options={PAYMENT_METHOD_OPTIONS}
                selected={paymentMethods}
                onApply={setPaymentMethods}
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
        }
        emptyState={{
          title: hasActiveFilters
            ? 'Ningún pedido coincide con los filtros'
            : totalCount === 0 && !query.isLoading
              ? 'Sin pedidos TPV'
              : 'Cargando pedidos…',
          description: hasActiveFilters
            ? 'Ajusta los filtros arriba o limpia la selección.'
            : totalCount === 0 && !query.isLoading
              ? 'Cuando un venue compre hardware aparecerá aquí.'
              : 'Esto debería tardar menos de un segundo.',
        }}
        exportable={{
          filename: 'tpv-orders',
          columns: [
            {
              key: 'orderNumber',
              header: '# Pedido',
              accessor: (o) => o.orderNumber,
              defaultEnabled: true,
            },
            { key: 'venue', header: 'Venue', accessor: (o) => o.venue.name, defaultEnabled: true },
            { key: 'venueSlug', header: 'Venue slug', accessor: (o) => o.venue.slug },
            {
              key: 'contactName',
              header: 'Contacto',
              accessor: (o) => o.contactName,
              defaultEnabled: true,
            },
            {
              key: 'contactEmail',
              header: 'Email',
              accessor: (o) => o.contactEmail,
              defaultEnabled: true,
            },
            { key: 'contactPhone', header: 'Teléfono', accessor: (o) => o.contactPhone },
            {
              key: 'units',
              header: 'Unidades',
              accessor: (o) => String(totalUnits(o)),
              defaultEnabled: true,
            },
            {
              key: 'totalCents',
              header: 'Total (cents)',
              accessor: (o) => String(o.totalCents),
              defaultEnabled: true,
            },
            { key: 'currency', header: 'Moneda', accessor: (o) => o.currency },
            {
              key: 'paymentMethod',
              header: 'Método',
              accessor: (o) => humanizePaymentMethod(o.paymentMethod),
              defaultEnabled: true,
            },
            {
              key: 'paymentStatus',
              header: 'Estado pago',
              accessor: (o) => humanizePaymentStatus(o.paymentStatus),
              defaultEnabled: true,
            },
            {
              key: 'fulfillmentStatus',
              header: 'Fulfillment',
              accessor: (o) => humanizeFulfillmentStatus(o.fulfillmentStatus),
              defaultEnabled: true,
            },
            {
              key: 'createdAt',
              header: 'Creado',
              accessor: (o) => o.createdAt,
              defaultEnabled: true,
            },
          ],
          dateAccessor: (o) => o.createdAt,
        }}
      />
    </div>
  )
}

function KpiStrip({ data }: { data: KpiData }) {
  const focusActionable = data.focus.tone === 'actionable'
  return (
    <section
      aria-label="Indicadores de pedidos TPV"
      className="mb-8 flex flex-col gap-px overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--line)] sm:flex-row"
    >
      <article
        className={cn(
          'flex-[2] bg-[var(--canvas)] p-5',
          focusActionable && 'border-l-2 border-l-[var(--accent)]',
        )}
      >
        <p className="eyebrow flex items-center gap-1.5">
          <Package className="h-3 w-3 text-[var(--ink-faint)]" aria-hidden />
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
