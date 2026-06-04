import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/shared/ui/Badge'
import { DataTable } from '@/shared/data-table/DataTable'
import { FilterPill, MultiSelectFilterContent, type MultiSelectOption } from '@/shared/filters'
import { QueryError } from '@/shared/components/QueryError'
import { formatDate } from '@/shared/lib/datetime'
import { useSubscriptionOverview, useVenueSubscriptions } from './use-subscriptions'
import { SubscriptionRowActions } from './SubscriptionRowActions'
import {
  humanizeState,
  STATE_TONE,
  type SubscriptionState,
  type SuperadminVenueSubscription,
} from './types'

const MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
})
const NUM = new Intl.NumberFormat('es-MX')

const STATE_OPTIONS: MultiSelectOption<SubscriptionState>[] = [
  { value: 'active', label: 'Activa' },
  { value: 'trial', label: 'En prueba' },
  { value: 'canceling', label: 'Por cancelar' },
  { value: 'past_due', label: 'Pago vencido' },
  { value: 'suspended', label: 'Suspendida' },
  { value: 'canceled', label: 'Cancelada' },
  { value: 'none', label: 'Sin plan' },
]

export function SubscriptionsPage() {
  const overview = useSubscriptionOverview()
  const venues = useVenueSubscriptions({}) // load all; filter in-memory
  const [states, setStates] = useState<Set<SubscriptionState>>(new Set())

  const filtered = useMemo(() => {
    const rows = venues.data ?? []
    return states.size > 0 ? rows.filter((r) => states.has(r.state)) : rows
  }, [venues.data, states])

  const columns = useMemo<ColumnDef<SuperadminVenueSubscription, unknown>[]>(
    () => [
      {
        id: 'venue',
        header: 'Venue',
        accessorFn: (r) => `${r.name} ${r.slug}`,
        cell: ({ row }) => (
          <Link to={`/venues/${row.original.venueId}`} className="block min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]">
              {row.original.name}
            </p>
            <p className="truncate text-[10.5px] text-[var(--ink-faint)]">
              {row.original.owner.email ?? 'sin owner'}
            </p>
          </Link>
        ),
      },
      {
        id: 'plan',
        header: 'Plan',
        accessorFn: (r) => r.planTier ?? '',
        cell: ({ row }) => <Badge tone="accent">{row.original.planTier ?? '—'}</Badge>,
      },
      {
        id: 'state',
        header: 'Estado',
        accessorFn: (r) => r.state,
        cell: ({ row }) => (
          <Badge tone={STATE_TONE[row.original.state]}>{humanizeState(row.original.state)}</Badge>
        ),
      },
      {
        id: 'mrr',
        header: () => <span className="block text-right">MRR</span>,
        accessorFn: (r) => r.mrr,
        cell: ({ row }) =>
          row.original.mrr > 0 ? (
            <p className="tabular text-right text-[13px] font-semibold">
              {MXN.format(row.original.mrr)}
            </p>
          ) : (
            <span className="block text-right text-[var(--ink-faint)]">—</span>
          ),
        sortingFn: 'basic',
      },
      {
        id: 'renewal',
        header: 'Renovación',
        accessorFn: (r) => r.currentPeriodEnd ?? r.trialEndsAt ?? '',
        cell: ({ row }) => {
          const d = row.original.currentPeriodEnd ?? row.original.trialEndsAt
          return <span className="tabular text-[12px]">{d ? formatDate(d) : '—'}</span>
        },
      },
      {
        id: 'actions',
        header: () => <span className="block text-right">Acciones</span>,
        enableSorting: false,
        cell: ({ row }) => <SubscriptionRowActions row={row.original} />,
      },
    ],
    [],
  )

  const toolbar = (
    <FilterPill label="Estado" activeCount={states.size} onClear={() => setStates(new Set())}>
      <MultiSelectFilterContent
        title="Estado de suscripción"
        options={STATE_OPTIONS}
        selected={states}
        onApply={setStates}
      />
    </FilterPill>
  )

  const c = overview.data?.counts
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7">
        <p className="eyebrow">Catálogo</p>
        <h1 className="mt-1.5 font-display text-[28px] font-semibold tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
          Suscripciones
        </h1>
        <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
          Estado del Plan Avoqado Pro por venue, con MRR de la flota.
        </p>
      </header>

      {overview.isError && (
        <QueryError
          className="mb-5"
          error={overview.error}
          context="cargar resumen"
          onRetry={() => overview.refetch()}
        />
      )}

      {c && (
        <section
          aria-label="Resumen de suscripciones"
          className="mb-8 flex flex-col gap-px overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--line)] sm:flex-row"
        >
          <article className="flex-[2] bg-[var(--canvas)] p-5">
            <p className="eyebrow">MRR total</p>
            <p className="mt-2.5 font-display tabular text-[32px] font-semibold text-[var(--ink)]">
              {MXN.format(overview.data!.mrr.total)}
            </p>
            <p className="mt-3 text-[12px] text-[var(--ink-muted)]">
              {NUM.format(c.active)} activas · {NUM.format(c.trial)} en prueba
            </p>
          </article>
          {[
            { k: 'Por cancelar', v: c.canceling },
            { k: 'Pago vencido', v: c.past_due },
            { k: 'Suspendidas', v: c.suspended },
            { k: 'Sin plan', v: c.none },
          ].map((t) => (
            <article key={t.k} className="flex-1 bg-[var(--canvas)] p-4">
              <p className="eyebrow">{t.k}</p>
              <p className="mt-2.5 font-display tabular text-[22px] font-semibold text-[var(--ink)]">
                {NUM.format(t.v)}
              </p>
            </article>
          ))}
        </section>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder="Buscar por nombre o slug…"
        caption={`Tabla de ${filtered.length} suscripciones.`}
        initialSorting={[{ id: 'mrr', desc: true }]}
        pageSize={25}
        toolbar={toolbar}
        emptyState={{
          title: venues.isLoading ? 'Cargando…' : 'Sin suscripciones',
          description: 'Los venues con Plan Pro aparecerán aquí.',
        }}
      />
    </div>
  )
}
