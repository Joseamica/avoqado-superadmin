import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CreditCard, Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { buttonVariants } from '@/shared/ui/button-variants'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Tooltip } from '@/shared/ui/Tooltip'
import { DataTable } from '@/shared/data-table/DataTable'
import {
  FilterPill,
  MultiSelectFilterContent,
  SingleSelectFilterContent,
  type MultiSelectOption,
  type SingleSelectOption,
} from '@/shared/filters'
import { QueryError } from '@/shared/components/QueryError'
import { cn } from '@/shared/lib/utils'
import { inspectApiError } from '@/shared/lib/api-error'
import { formatRelative } from '@/shared/lib/datetime'
import { usePaymentProviders, useTogglePaymentProvider } from './use-payment-providers'
import {
  COUNTRY_OPTIONS,
  humanizeProviderType,
  PROVIDER_TYPE_TONE,
  type PaymentProvider,
  type ProviderType,
} from './types'

const NUM = new Intl.NumberFormat('es-MX')

const TYPE_OPTIONS: MultiSelectOption<ProviderType>[] = [
  { value: 'PAYMENT_PROCESSOR', label: 'Procesador de pagos' },
  { value: 'GATEWAY', label: 'Gateway' },
  { value: 'BANK_DIRECT', label: 'Banco directo' },
  { value: 'WALLET', label: 'Wallet' },
  { value: 'OTHER', label: 'Otro' },
]

const COUNTRY_FILTER_OPTIONS: MultiSelectOption<string>[] = COUNTRY_OPTIONS.map((c) => ({
  value: c.code,
  label: `${c.name} (${c.code})`,
}))

type ActiveOption = 'all' | 'active' | 'inactive'

const ACTIVE_OPTIONS: SingleSelectOption<ActiveOption>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Solo activos' },
  { value: 'inactive', label: 'Solo inactivos' },
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

export function PaymentProvidersPage() {
  const [types, setTypes] = useState<Set<ProviderType>>(new Set())
  const [countries, setCountries] = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState<ActiveOption>('all')

  const query = usePaymentProviders({})
  const toggleMutation = useTogglePaymentProvider()

  const filtered = useMemo(() => {
    let list = query.data ?? []
    if (types.size > 0) list = list.filter((p) => types.has(p.type))
    if (countries.size > 0) {
      list = list.filter((p) => p.countryCode.some((c) => countries.has(c)))
    }
    if (activeFilter === 'active') list = list.filter((p) => p.active)
    if (activeFilter === 'inactive') list = list.filter((p) => !p.active)
    return list
  }, [query.data, types, countries, activeFilter])

  const totalCount = query.data?.length ?? 0
  const hasActiveFilters = types.size > 0 || countries.size > 0 || activeFilter !== 'all'
  const resetAllFilters = () => {
    setTypes(new Set())
    setCountries(new Set())
    setActiveFilter('all')
  }

  // `useCallback` para mantener la referencia estable entre renders — el
  // `useMemo` de las columnas (donde se usa) tiene esta función como
  // dependencia, y sin estabilidad la tabla se recrearía en cada render
  // y perdería el sort/page state.
  const handleToggle = useCallback(
    (provider: PaymentProvider) => {
      toggleMutation.mutate(provider.id, {
        onSuccess: (updated) => {
          toast.success(`${updated.name} ${updated.active ? 'activado' : 'desactivado'}`)
        },
        onError: (e) => {
          const info = inspectApiError(e, 'cambiar el estado del provider')
          toast.error(info.title, { description: info.description })
        },
      })
    },
    [toggleMutation],
  )

  const columns = useMemo<ColumnDef<PaymentProvider, unknown>[]>(
    () => [
      {
        id: 'provider',
        header: 'Provider',
        accessorFn: (row) => `${row.code} ${row.name}`,
        cell: ({ row }) => (
          <Link
            to={`/payment-providers/${row.original.id}`}
            className="group block min-w-0 -my-1 -mx-1 rounded-[4px] px-1 py-1 transition-colors hover:bg-[var(--canvas-sunken)]"
          >
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--ink-faint)]">
              {row.original.code}
            </p>
            <p className="mt-0.5 truncate text-[13.5px] font-semibold text-[var(--ink)] group-hover:text-[var(--accent)]">
              {row.original.name}
            </p>
          </Link>
        ),
        meta: { headerClassName: 'min-w-[220px]' },
      },
      {
        id: 'type',
        header: 'Tipo',
        accessorFn: (row) => row.type,
        cell: ({ row }) => (
          <Badge tone={PROVIDER_TYPE_TONE[row.original.type]}>
            {humanizeProviderType(row.original.type)}
          </Badge>
        ),
        meta: { headerClassName: 'w-[180px]' },
      },
      {
        id: 'countries',
        header: 'Países',
        accessorFn: (row) => row.countryCode.join(','),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            {row.original.countryCode.length === 0 ? (
              <span className="text-[11.5px] italic text-[var(--ink-faint)]">—</span>
            ) : (
              row.original.countryCode.map((c) => (
                <span
                  key={c}
                  className="inline-flex h-5 items-center rounded-full border border-[var(--line-strong)] bg-[var(--canvas-sunken)] px-1.5 text-[10.5px] font-medium text-[var(--ink-muted)]"
                >
                  {c}
                </span>
              ))
            )}
          </div>
        ),
        meta: { headerClassName: 'w-[160px]' },
        enableSorting: false,
      },
      {
        id: 'merchants',
        header: () => <span className="block text-right">Merchants</span>,
        accessorFn: (row) => row.merchantsCount ?? 0,
        cell: ({ row }) => (
          <p className="tabular text-right text-[13px] text-[var(--ink-muted)]">
            {NUM.format(row.original.merchantsCount ?? 0)}
          </p>
        ),
        sortingFn: 'basic',
        meta: { headerClassName: 'w-[110px]' },
      },
      {
        id: 'active',
        header: 'Activo',
        accessorFn: (row) => (row.active ? 1 : 0),
        cell: ({ row }) => (
          <Tooltip
            content={
              row.original.active
                ? 'Desactivar — el provider deja de aceptar merchant accounts nuevas, pero las existentes siguen operando.'
                : 'Activar — el provider vuelve a estar disponible para asignar a merchants nuevas.'
            }
          >
            <span className="inline-flex items-center" tabIndex={0}>
              <Checkbox
                checked={row.original.active}
                onCheckedChange={() => handleToggle(row.original)}
                aria-label={`Toggle activo de ${row.original.name}`}
              />
            </span>
          </Tooltip>
        ),
        sortingFn: 'basic',
        meta: { headerClassName: 'w-[90px]' },
      },
      {
        id: 'updatedAt',
        header: 'Actualizado',
        accessorFn: (row) => new Date(row.updatedAt).getTime(),
        cell: ({ row }) => (
          <p className="tabular text-[12px] text-[var(--ink-faint)]">
            {formatRelative(row.original.updatedAt)}
          </p>
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
            to={`/payment-providers/${row.original.id}`}
            aria-label={`Editar ${row.original.name}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[var(--ink-faint)] transition-colors hover:bg-[var(--canvas-sunken)] hover:text-[var(--ink)]"
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ),
        meta: { headerClassName: 'w-[48px]' },
      },
    ],
    [handleToggle],
  )

  const activeCount = query.data?.filter((p) => p.active).length ?? 0
  const inactiveCount = totalCount - activeCount

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="eyebrow">Configuración</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            Proveedores de pago
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Las empresas que procesan transacciones (Blumon, AngelPay, Menta, Stripe). Cada merchant
            account vive bajo un provider.
            <span className="tabular ml-2 text-[var(--ink-faint)]">
              · {NUM.format(activeCount)} activos · {NUM.format(inactiveCount)} inactivos
            </span>
          </p>
        </div>
        <Link
          to="/payment-providers/new"
          className={buttonVariants({ size: 'md', className: 'shrink-0 gap-2' })}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Nuevo provider
        </Link>
      </header>

      {query.isError && (
        <QueryError
          className="mb-5"
          error={query.error}
          context="cargar payment providers"
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder="Buscar por code o nombre…"
        caption={`Tabla de ${filtered.length} payment providers${hasActiveFilters ? ' filtrados' : ''}.`}
        initialSorting={[{ id: 'provider', desc: false }]}
        pageSize={25}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              label="Tipo"
              activeLabel={formatActiveLabel(types, TYPE_OPTIONS)}
              activeCount={types.size}
              onClear={() => setTypes(new Set())}
            >
              <MultiSelectFilterContent
                title="Tipo de provider"
                options={TYPE_OPTIONS}
                selected={types}
                onApply={setTypes}
              />
            </FilterPill>
            <FilterPill
              label="País"
              activeLabel={formatActiveLabel(countries, COUNTRY_FILTER_OPTIONS)}
              activeCount={countries.size}
              onClear={() => setCountries(new Set())}
            >
              <MultiSelectFilterContent
                title="País del provider"
                options={COUNTRY_FILTER_OPTIONS}
                selected={countries}
                onApply={setCountries}
              />
            </FilterPill>
            <FilterPill
              label="Estado"
              activeLabel={
                activeFilter === 'all' ? null : activeFilter === 'active' ? 'Activos' : 'Inactivos'
              }
              onClear={activeFilter !== 'all' ? () => setActiveFilter('all') : undefined}
            >
              <SingleSelectFilterContent
                title="Filtrar por estado"
                options={ACTIVE_OPTIONS}
                selected={activeFilter}
                onChange={setActiveFilter}
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
            ? 'Ningún provider coincide con los filtros'
            : totalCount === 0 && !query.isLoading
              ? 'Sin payment providers registrados'
              : 'Cargando providers…',
          description: hasActiveFilters
            ? 'Ajusta los filtros o limpia la selección.'
            : totalCount === 0 && !query.isLoading
              ? 'Crea tu primer provider para empezar a configurar merchant accounts.'
              : 'Esto debería tardar menos de un segundo.',
        }}
        exportable={{
          filename: 'payment-providers',
          columns: [
            { key: 'id', header: 'ID', accessor: (p) => p.id, defaultEnabled: true },
            { key: 'code', header: 'Code', accessor: (p) => p.code, defaultEnabled: true },
            { key: 'name', header: 'Nombre', accessor: (p) => p.name, defaultEnabled: true },
            {
              key: 'type',
              header: 'Tipo',
              accessor: (p) => humanizeProviderType(p.type),
              defaultEnabled: true,
            },
            {
              key: 'countries',
              header: 'Países',
              accessor: (p) => p.countryCode.join(','),
              defaultEnabled: true,
            },
            {
              key: 'active',
              header: 'Activo',
              accessor: (p) => (p.active ? 'Sí' : 'No'),
              defaultEnabled: true,
            },
            {
              key: 'merchants',
              header: '# merchants',
              accessor: (p) => p.merchantsCount ?? 0,
              defaultEnabled: true,
            },
            { key: 'createdAt', header: 'Creado', accessor: (p) => p.createdAt },
            { key: 'updatedAt', header: 'Actualizado', accessor: (p) => p.updatedAt },
          ],
          dateAccessor: (p) => p.updatedAt,
        }}
      />

      <div className="mt-6 flex items-start gap-3 rounded-[6px] border border-[var(--line)] bg-[var(--canvas-sunken)] p-4 text-[12px] text-[var(--ink-muted)]">
        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-faint)]" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-[var(--ink)]">¿Provider vs Merchant account?</p>
          <p className={cn('mt-0.5 leading-snug')}>
            Un <span className="font-semibold text-[var(--ink)]">payment provider</span> es la
            empresa (Blumon, AngelPay…). Una{' '}
            <span className="font-semibold text-[var(--ink)]">merchant account</span> es tu cuenta
            específica dentro de ese provider (con tu serial, tu posId, tu apiKey). Aquí configuras
            el primer nivel; los merchants viven en{' '}
            <Link to="/merchants" className="text-[var(--accent)] hover:underline">
              /merchants
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
