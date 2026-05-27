import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/shared/data-table/DataTable'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { formatMoney } from '@/shared/lib/money'
import { iconButtonVariants } from '@/shared/ui/icon-button-variants'
import type {
  EarningsSummary,
  VenueEarnings,
  MerchantEarnings,
  ProviderEarnings,
  CardTypeEarnings,
  ChannelEarnings,
} from './types'

export type TabKey = 'venue' | 'merchant' | 'provider' | 'card' | 'channel'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'venue', label: 'Negocio' },
  { key: 'merchant', label: 'Merchant' },
  { key: 'provider', label: 'Proveedor' },
  { key: 'card', label: 'Tarjeta' },
  { key: 'channel', label: 'Canal online' },
]

const intFmt = new Intl.NumberFormat('es-MX')
const right = { headerClassName: 'text-right', cellClassName: 'text-right' } as const
const money = (v: number) => <span className="tabular-nums">{formatMoney(v)}</span>
const count = (v: number) => <span className="tabular-nums">{intFmt.format(v)}</span>
const actionMeta = { headerClassName: 'w-[44px]', cellClassName: 'text-right' } as const

const pct = (n: number) => `${(n * 100).toFixed(2)}%`

/** "Ganancia neta" cell: the net amount, with its margin % (net/volume) and an
 *  optional "Revenue share" tag underneath. */
const netCell = (netProfit: number, volume: number, revenueShare?: boolean) => (
  <div className="flex flex-col items-end gap-0.5">
    <span className="tabular-nums">{formatMoney(netProfit)}</span>
    <span className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--ink-faint)]">
      <span className="tabular-nums">{pct(volume > 0 ? netProfit / volume : 0)}</span>
      {revenueShare ? (
        <Badge tone="muted" size="sm">
          Revenue share
        </Badge>
      ) : null}
    </span>
  </div>
)

/** Row action: arrow link to an entity's detail page (mirrors MerchantsPage). */
const detailLink = (to: string, label: string) => (
  <Link
    to={to}
    state={{ name: label }}
    className={iconButtonVariants({ size: 'sm' })}
    aria-label={`Abrir ${label}`}
  >
    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
  </Link>
)

export function EarningsBreakdown({
  summary,
  tabs,
}: {
  summary: EarningsSummary
  tabs?: readonly TabKey[]
}) {
  const visibleTabs = tabs ? TABS.filter((t) => tabs.includes(t.key)) : TABS
  const [tab, setTab] = useState<TabKey>(visibleTabs[0]?.key ?? 'venue')

  const venueColumns = useMemo<ColumnDef<VenueEarnings, unknown>[]>(
    () => [
      {
        id: 'venueName',
        header: 'Negocio',
        accessorFn: (r) => r.venueName,
        cell: ({ row }) => row.original.venueName,
      },
      {
        id: 'volume',
        header: 'Volumen',
        accessorFn: (r) => r.volume,
        cell: ({ row }) => money(row.original.volume),
        meta: right,
      },
      {
        id: 'netProfit',
        header: 'Ganancia neta',
        accessorFn: (r) => r.netProfit,
        cell: ({ row }) =>
          netCell(row.original.netProfit, row.original.volume, row.original.hasRevenueShare),
        meta: right,
      },
      {
        id: 'transactions',
        header: 'Txns',
        accessorFn: (r) => r.transactions,
        cell: ({ row }) => count(row.original.transactions),
        meta: right,
      },
      {
        id: 'detalle',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          detailLink(`/earnings/venue/${row.original.venueId}`, row.original.venueName),
        meta: actionMeta,
      },
    ],
    [],
  )
  const merchantColumns = useMemo<ColumnDef<MerchantEarnings, unknown>[]>(
    () => [
      {
        id: 'label',
        header: 'Merchant',
        accessorFn: (r) => r.label,
        cell: ({ row }) => row.original.label,
      },
      {
        id: 'providerCode',
        header: 'Proveedor',
        accessorFn: (r) => r.providerCode,
        cell: ({ row }) => (
          <Badge tone="muted" size="sm">
            {row.original.providerCode}
          </Badge>
        ),
      },
      {
        id: 'volume',
        header: 'Volumen',
        accessorFn: (r) => r.volume,
        cell: ({ row }) => money(row.original.volume),
        meta: right,
      },
      {
        id: 'tramoProvider',
        header: 'Prov→agg',
        accessorFn: (r) => r.tramoProvider,
        cell: ({ row }) => money(row.original.tramoProvider),
        meta: right,
      },
      {
        id: 'tramoAggregator',
        header: 'Agg→venue',
        accessorFn: (r) => r.tramoAggregator,
        cell: ({ row }) => money(row.original.tramoAggregator),
        meta: right,
      },
      {
        id: 'netProfit',
        header: 'Neto',
        accessorFn: (r) => r.netProfit,
        cell: ({ row }) =>
          netCell(row.original.netProfit, row.original.volume, row.original.hasRevenueShare),
        meta: right,
      },
      {
        id: 'transactions',
        header: 'Txns',
        accessorFn: (r) => r.transactions,
        cell: ({ row }) => count(row.original.transactions),
        meta: right,
      },
      {
        id: 'detalle',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          detailLink(`/earnings/merchant/${row.original.merchantAccountId}`, row.original.label),
        meta: actionMeta,
      },
    ],
    [],
  )
  const providerColumns = useMemo<ColumnDef<ProviderEarnings, unknown>[]>(
    () => [
      {
        id: 'providerName',
        header: 'Proveedor',
        accessorFn: (r) => r.providerName,
        cell: ({ row }) => row.original.providerName,
      },
      {
        id: 'volume',
        header: 'Volumen',
        accessorFn: (r) => r.volume,
        cell: ({ row }) => money(row.original.volume),
        meta: right,
      },
      {
        id: 'netProfit',
        header: 'Ganancia neta',
        accessorFn: (r) => r.netProfit,
        cell: ({ row }) => netCell(row.original.netProfit, row.original.volume),
        meta: right,
      },
      {
        id: 'transactions',
        header: 'Txns',
        accessorFn: (r) => r.transactions,
        cell: ({ row }) => count(row.original.transactions),
        meta: right,
      },
      {
        id: 'detalle',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          detailLink(`/payment-providers/${row.original.providerId}`, row.original.providerName),
        meta: actionMeta,
      },
    ],
    [],
  )
  const cardColumns = useMemo<ColumnDef<CardTypeEarnings, unknown>[]>(
    () => [
      {
        id: 'type',
        header: 'Tipo',
        accessorFn: (r) => r.type,
        cell: ({ row }) => (
          <Badge tone="muted" size="sm">
            {row.original.type}
          </Badge>
        ),
      },
      {
        id: 'volume',
        header: 'Volumen',
        accessorFn: (r) => r.volume,
        cell: ({ row }) => money(row.original.volume),
        meta: right,
      },
      {
        id: 'netProfit',
        header: 'Ganancia neta',
        accessorFn: (r) => r.netProfit,
        cell: ({ row }) => netCell(row.original.netProfit, row.original.volume),
        meta: right,
      },
      {
        id: 'transactions',
        header: 'Txns',
        accessorFn: (r) => r.transactions,
        cell: ({ row }) => count(row.original.transactions),
        meta: right,
      },
    ],
    [],
  )
  const channelColumns = useMemo<ColumnDef<ChannelEarnings, unknown>[]>(
    () => [
      {
        id: 'label',
        header: 'Canal',
        accessorFn: (r) => r.label,
        cell: ({ row }) => row.original.label,
      },
      {
        id: 'providerCode',
        header: 'Proveedor',
        accessorFn: (r) => r.providerCode,
        cell: ({ row }) => (
          <Badge tone="muted" size="sm">
            {row.original.providerCode}
          </Badge>
        ),
      },
      {
        id: 'volume',
        header: 'Volumen',
        accessorFn: (r) => r.volume,
        cell: ({ row }) => money(row.original.volume),
        meta: right,
      },
      {
        id: 'fees',
        header: 'Comisión',
        accessorFn: (r) => r.fees,
        cell: ({ row }) => money(row.original.fees),
        meta: right,
      },
      {
        id: 'transactions',
        header: 'Txns',
        accessorFn: (r) => r.transactions,
        cell: ({ row }) => count(row.original.transactions),
        meta: right,
      },
    ],
    [],
  )

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {visibleTabs.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={t.key === tab ? 'secondary' : 'ghost'}
            aria-pressed={t.key === tab}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'venue' && (
        <DataTable
          data={summary.byVenue}
          columns={venueColumns}
          searchPlaceholder="Buscar negocio…"
          initialSorting={[{ id: 'netProfit', desc: true }]}
          emptyState={{
            title: 'Sin ganancias por negocio',
            description: 'No hubo transacciones en este rango.',
          }}
          caption="Ganancias netas por negocio"
          exportable={{
            filename: 'ganancias-negocio',
            columns: [
              { key: 'venueName', header: 'Negocio', accessor: (r) => r.venueName },
              { key: 'volume', header: 'Volumen', accessor: (r) => r.volume },
              { key: 'terminalNet', header: 'Neto terminales', accessor: (r) => r.terminalNet },
              { key: 'onlineFees', header: 'Comisión online', accessor: (r) => r.onlineFees },
              { key: 'netProfit', header: 'Ganancia neta', accessor: (r) => r.netProfit },
              {
                key: 'margin',
                header: 'Margen',
                accessor: (r) => (r.volume > 0 ? r.netProfit / r.volume : 0),
              },
              {
                key: 'revenueShare',
                header: 'Revenue share',
                accessor: (r) => (r.hasRevenueShare ? 'Sí' : 'No'),
              },
              { key: 'transactions', header: 'Transacciones', accessor: (r) => r.transactions },
            ],
          }}
        />
      )}
      {tab === 'merchant' && (
        <DataTable
          data={summary.byMerchant}
          columns={merchantColumns}
          searchPlaceholder="Buscar merchant…"
          initialSorting={[{ id: 'netProfit', desc: true }]}
          emptyState={{
            title: 'Sin ganancias por merchant',
            description: 'No hubo transacciones en este rango.',
          }}
          caption="Ganancias netas por merchant account (con los dos tramos)"
          exportable={{
            filename: 'ganancias-merchant',
            columns: [
              { key: 'label', header: 'Merchant', accessor: (r) => r.label },
              { key: 'providerCode', header: 'Proveedor', accessor: (r) => r.providerCode },
              { key: 'volume', header: 'Volumen', accessor: (r) => r.volume },
              { key: 'tramoProvider', header: 'Margen prov→agg', accessor: (r) => r.tramoProvider },
              {
                key: 'tramoAggregator',
                header: 'Margen agg→venue',
                accessor: (r) => r.tramoAggregator,
              },
              { key: 'netProfit', header: 'Ganancia neta', accessor: (r) => r.netProfit },
              {
                key: 'margin',
                header: 'Margen',
                accessor: (r) => (r.volume > 0 ? r.netProfit / r.volume : 0),
              },
              {
                key: 'revenueShare',
                header: 'Revenue share',
                accessor: (r) => (r.hasRevenueShare ? 'Sí' : 'No'),
              },
              { key: 'transactions', header: 'Transacciones', accessor: (r) => r.transactions },
            ],
          }}
        />
      )}
      {tab === 'provider' && (
        <DataTable
          data={summary.byProvider}
          columns={providerColumns}
          searchPlaceholder="Buscar proveedor…"
          initialSorting={[{ id: 'netProfit', desc: true }]}
          emptyState={{
            title: 'Sin datos por proveedor',
            description: 'No hubo transacciones en este rango.',
          }}
          caption="Ganancia neta por proveedor"
          exportable={{
            filename: 'ganancias-proveedor',
            columns: [
              { key: 'providerName', header: 'Proveedor', accessor: (r) => r.providerName },
              { key: 'providerCode', header: 'Código', accessor: (r) => r.providerCode },
              { key: 'volume', header: 'Volumen', accessor: (r) => r.volume },
              { key: 'netProfit', header: 'Ganancia neta', accessor: (r) => r.netProfit },
              {
                key: 'margin',
                header: 'Margen',
                accessor: (r) => (r.volume > 0 ? r.netProfit / r.volume : 0),
              },
              { key: 'transactions', header: 'Transacciones', accessor: (r) => r.transactions },
            ],
          }}
        />
      )}
      {tab === 'card' && (
        <DataTable
          data={summary.byCardType}
          columns={cardColumns}
          emptyState={{
            title: 'Sin datos por tarjeta',
            description: 'No hubo transacciones en este rango.',
          }}
          caption="Ganancia neta por tipo de tarjeta"
          exportable={{
            filename: 'ganancias-tarjeta',
            columns: [
              { key: 'type', header: 'Tipo', accessor: (r) => r.type },
              { key: 'volume', header: 'Volumen', accessor: (r) => r.volume },
              { key: 'netProfit', header: 'Ganancia neta', accessor: (r) => r.netProfit },
              {
                key: 'margin',
                header: 'Margen',
                accessor: (r) => (r.volume > 0 ? r.netProfit / r.volume : 0),
              },
              { key: 'transactions', header: 'Transacciones', accessor: (r) => r.transactions },
            ],
          }}
        />
      )}
      {tab === 'channel' && (
        <DataTable
          data={summary.byChannel}
          columns={channelColumns}
          searchPlaceholder="Buscar canal…"
          initialSorting={[{ id: 'fees', desc: true }]}
          emptyState={{
            title: 'Sin cobros en línea',
            description: 'No hubo cobros por internet en este rango.',
          }}
          caption="Comisiones por canal online"
          exportable={{
            filename: 'ganancias-canal-online',
            columns: [
              { key: 'label', header: 'Canal', accessor: (r) => r.label },
              { key: 'providerCode', header: 'Proveedor', accessor: (r) => r.providerCode },
              { key: 'volume', header: 'Volumen', accessor: (r) => r.volume },
              { key: 'fees', header: 'Comisión', accessor: (r) => r.fees },
              { key: 'transactions', header: 'Transacciones', accessor: (r) => r.transactions },
            ],
          }}
        />
      )}
    </section>
  )
}
