import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/shared/data-table/DataTable'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { iconButtonVariants } from '@/shared/ui/icon-button-variants'
import { QueryError } from '@/shared/components/QueryError'
import { useMerchants } from './use-merchants'
import { activeTone, environmentTone, humanizeEnvironment, type MerchantAccount } from './types'
import { MerchantIdentityDrawer } from './MerchantIdentityDrawer'

export function MerchantsPage() {
  const navigate = useNavigate()
  const query = useMerchants()
  const merchants = useMemo(() => query.data ?? [], [query.data])
  const [creating, setCreating] = useState(false)

  const columns = useMemo<ColumnDef<MerchantAccount, unknown>[]>(
    () => [
      {
        id: 'cuenta',
        header: 'Cuenta',
        accessorFn: (m) => m.displayName ?? m.alias ?? m.externalMerchantId,
        cell: ({ row }) => {
          const m = row.original
          return (
            <div className="flex flex-col">
              <span className="font-medium text-[var(--ink)]">
                {m.displayName ?? m.alias ?? m.externalMerchantId}
              </span>
              <span className="tabular text-[11.5px] text-[var(--ink-faint)]">
                {m.externalMerchantId}
                {m.blumonSerialNumber ? ` · ${m.blumonSerialNumber}` : ''}
              </span>
            </div>
          )
        },
      },
      {
        id: 'provider',
        header: 'Proveedor',
        accessorFn: (m) => m.provider.name,
        cell: ({ row }) => (
          <Badge tone="muted" size="sm">
            {row.original.provider.name}
          </Badge>
        ),
      },
      {
        id: 'ambiente',
        header: 'Ambiente',
        accessorFn: (m) => m.blumonEnvironment ?? '',
        cell: ({ row }) =>
          row.original.blumonEnvironment ? (
            <Badge tone={environmentTone(row.original.blumonEnvironment)} size="sm">
              {humanizeEnvironment(row.original.blumonEnvironment)}
            </Badge>
          ) : (
            <span className="text-[var(--ink-faint)]">—</span>
          ),
      },
      {
        id: 'estado',
        header: 'Estado',
        accessorFn: (m) => (m.active ? 'Activa' : 'Inactiva'),
        cell: ({ row }) => (
          <Badge tone={activeTone(row.original.active)} size="sm">
            {row.original.active ? 'Activa' : 'Inactiva'}
          </Badge>
        ),
      },
      {
        id: 'cuentas',
        header: 'Costos · Venues · TPVs',
        enableSorting: false,
        cell: ({ row }) => {
          const c = row.original.counts
          return (
            <span className="tabular text-[13px] text-[var(--ink-muted)]">
              {c.costStructures} · {c.venueConfigs} · {c.terminals}
            </span>
          )
        },
      },
      {
        id: 'acciones',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to={`/merchants/${row.original.id}`}
            className={iconButtonVariants({ size: 'sm' })}
            aria-label={`Abrir ${row.original.displayName ?? row.original.externalMerchantId}`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ),
        meta: { headerClassName: 'w-[56px]', cellClassName: 'text-right' },
      },
    ],
    [],
  )

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Pagos</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            Merchant accounts
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Cuentas de pago por proveedor — costos, liquidación y a qué venues sirven.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/merchants/new')}>
            + Alta guiada (Blumon)
          </Button>
          <Button onClick={() => setCreating(true)}>+ Alta manual</Button>
        </div>
      </header>

      {query.isError && (
        <QueryError
          className="mb-5"
          error={query.error}
          context="cargar los merchant accounts"
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      <DataTable
        data={merchants}
        columns={columns}
        searchPlaceholder="Buscar por cuenta, proveedor, serial…"
        initialSorting={[{ id: 'estado', desc: false }]}
        emptyState={{
          title: 'No hay merchant accounts',
          description: query.isLoading
            ? 'Cargando…'
            : 'Aún no se ha registrado ninguna cuenta de pago.',
        }}
        caption="Listado de merchant accounts"
      />

      <MerchantIdentityDrawer
        open={creating}
        onOpenChange={setCreating}
        onSaved={(m) => navigate(`/merchants/${m.id}`)}
      />
    </div>
  )
}
