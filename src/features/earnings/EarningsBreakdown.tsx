import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/shared/data-table/DataTable'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { formatMoney } from '@/shared/lib/money'
import type {
  EarningsSummary,
  VenueEarnings,
  MerchantEarnings,
  ProviderEarnings,
  CardTypeEarnings,
  ChannelEarnings,
} from './types'

type TabKey = 'venue' | 'merchant' | 'provider' | 'card' | 'channel'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'venue', label: 'Negocio' },
  { key: 'merchant', label: 'Merchant' },
  { key: 'provider', label: 'Proveedor' },
  { key: 'card', label: 'Tarjeta' },
  { key: 'channel', label: 'Canal online' },
]

const intFmt = new Intl.NumberFormat('es-MX')
const pct = (n: number) => `${(n * 100).toFixed(2)}%`
const right = { headerClassName: 'text-right', cellClassName: 'text-right' } as const
const money = (v: number) => <span className="tabular-nums">{formatMoney(v)}</span>
const count = (v: number) => <span className="tabular-nums">{intFmt.format(v)}</span>

export function EarningsBreakdown({ summary }: { summary: EarningsSummary }) {
  const [tab, setTab] = useState<TabKey>('venue')

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
        id: 'profit',
        header: 'Ganancia',
        accessorFn: (r) => r.profit,
        cell: ({ row }) => money(row.original.profit),
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
        id: 'profit',
        header: 'Ganancia',
        accessorFn: (r) => r.profit,
        cell: ({ row }) => money(row.original.profit),
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
        id: 'cost',
        header: 'Costo',
        accessorFn: (r) => r.cost,
        cell: ({ row }) => money(row.original.cost),
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
        id: 'profit',
        header: 'Ganancia',
        accessorFn: (r) => r.profit,
        cell: ({ row }) => money(row.original.profit),
        meta: right,
      },
      {
        id: 'margin',
        header: 'Margen',
        accessorFn: (r) => r.margin,
        cell: ({ row }) => <span className="tabular-nums">{pct(row.original.margin)}</span>,
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
        {TABS.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={t.key === tab ? 'secondary' : 'ghost'}
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
          initialSorting={[{ id: 'profit', desc: true }]}
          emptyState={{
            title: 'Sin ganancias por negocio',
            description: 'No hubo transacciones en este rango.',
          }}
          caption="Ganancias por negocio"
          exportable={{
            filename: 'ganancias-negocio',
            columns: [
              { key: 'venueName', header: 'Negocio', accessor: (r) => r.venueName },
              { key: 'volume', header: 'Volumen', accessor: (r) => r.volume },
              {
                key: 'terminalProfit',
                header: 'Ganancia terminal',
                accessor: (r) => r.terminalProfit,
              },
              { key: 'onlineFees', header: 'Comisión online', accessor: (r) => r.onlineFees },
              { key: 'profit', header: 'Ganancia total', accessor: (r) => r.profit },
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
          initialSorting={[{ id: 'profit', desc: true }]}
          emptyState={{
            title: 'Sin ganancias por merchant',
            description: 'No hubo transacciones en este rango.',
          }}
          caption="Ganancias por merchant account"
          exportable={{
            filename: 'ganancias-merchant',
            columns: [
              { key: 'label', header: 'Merchant', accessor: (r) => r.label },
              { key: 'providerCode', header: 'Proveedor', accessor: (r) => r.providerCode },
              { key: 'volume', header: 'Volumen', accessor: (r) => r.volume },
              { key: 'profit', header: 'Ganancia', accessor: (r) => r.profit },
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
          emptyState={{
            title: 'Sin datos por proveedor',
            description: 'No hubo transacciones en este rango.',
          }}
          caption="Volumen por proveedor"
          exportable={{
            filename: 'ganancias-proveedor',
            columns: [
              { key: 'providerName', header: 'Proveedor', accessor: (r) => r.providerName },
              { key: 'volume', header: 'Volumen', accessor: (r) => r.volume },
              { key: 'cost', header: 'Costo', accessor: (r) => r.cost },
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
          caption="Ganancias por tipo de tarjeta"
          exportable={{
            filename: 'ganancias-tarjeta',
            columns: [
              { key: 'type', header: 'Tipo', accessor: (r) => r.type },
              { key: 'volume', header: 'Volumen', accessor: (r) => r.volume },
              { key: 'profit', header: 'Ganancia', accessor: (r) => r.profit },
              { key: 'margin', header: 'Margen', accessor: (r) => r.margin },
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
