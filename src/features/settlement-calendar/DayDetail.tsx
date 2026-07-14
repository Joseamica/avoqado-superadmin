import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/shared/data-table/DataTable'
import { formatMoney } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/Badge'
import { formatDayLabel } from './month-grid'
import type { CalendarDay, CalendarVenue } from './types'

// El tono codifica un juicio: "ya cayó" es un hecho neutro (muted), "cae hoy" es
// lo accionable (success), "por caer" es futuro sin juicio (muted).
const STATUS: Record<CalendarDay['status'], { label: string; tone: 'muted' | 'success' }> = {
  settled: { label: 'Ya cayó', tone: 'muted' },
  today: { label: 'Cae hoy', tone: 'success' },
  projected: { label: 'Por caer', tone: 'muted' },
}

export function DayDetail({ day }: { day: CalendarDay }) {
  const columns = useMemo<ColumnDef<CalendarVenue, unknown>[]>(
    () => [
      {
        id: 'venue',
        header: 'Negocio',
        accessorFn: (row) => `${row.venueName} ${row.aggregatorNames.join(' ')}`,
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-semibold text-[var(--ink)]">
              {row.original.venueName}
            </span>
            {row.original.hasAggregator && (
              <Badge
                tone="muted"
                size="sm"
                title="El dinero pasa por un agregador antes de llegar al negocio"
              >
                {row.original.aggregatorNames.join(', ')}
              </Badge>
            )}
          </div>
        ),
        meta: { headerClassName: 'min-w-[200px]' },
      },
      {
        id: 'gross',
        header: 'Bruto',
        accessorFn: (row) => row.gross,
        cell: ({ row }) => (
          <span className="tabular text-[var(--ink-muted)]">{formatMoney(row.original.gross)}</span>
        ),
        meta: { headerClassName: 'w-[130px] text-right', cellClassName: 'text-right' },
      },
      {
        id: 'commission',
        header: 'Comisión',
        accessorFn: (row) => row.commission,
        cell: ({ row }) => (
          <span className="tabular text-[var(--ink-muted)]">
            −{formatMoney(row.original.commission)}
          </span>
        ),
        meta: { headerClassName: 'w-[130px] text-right', cellClassName: 'text-right' },
      },
      {
        id: 'net',
        header: 'Neto a depositar',
        accessorFn: (row) => row.net,
        cell: ({ row }) => (
          <span className="tabular font-semibold text-[var(--ink)]">
            {formatMoney(row.original.net)}
          </span>
        ),
        meta: { headerClassName: 'w-[150px] text-right', cellClassName: 'text-right' },
      },
      {
        id: 'count',
        header: 'Cobros',
        accessorFn: (row) => row.count,
        cell: ({ row }) => (
          <span className="tabular text-[var(--ink-muted)]">{row.original.count}</span>
        ),
        meta: { headerClassName: 'w-[90px] text-right', cellClassName: 'text-right' },
      },
    ],
    [],
  )

  const status = STATUS[day.status]

  return (
    <section>
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="display text-[17px] text-[var(--ink)]">{formatDayLabel(day.date)}</h2>
          <Badge tone={status.tone} size="sm">
            {status.label}
          </Badge>
        </div>
        <p className="label">
          {day.count} {day.count === 1 ? 'cobro' : 'cobros'} · comisión{' '}
          {formatMoney(day.commission)} · neto{' '}
          <span className="tabular font-semibold text-[var(--ink)]">{formatMoney(day.net)}</span>
        </p>
      </header>

      <DataTable
        data={day.venues}
        columns={columns}
        initialSorting={[{ id: 'net', desc: true }]}
        minWidth={700}
        caption={`Negocios con depósito el ${day.date}`}
        emptyState={{
          title: 'Sin depósitos este día',
          description: 'Ningún negocio recibe dinero en esta fecha.',
        }}
        exportable={{
          filename: `depositos-${day.date}`,
          columns: [
            {
              key: 'venueName',
              header: 'Negocio',
              accessor: (v) => v.venueName,
              defaultEnabled: true,
            },
            {
              key: 'aggregator',
              header: 'Agregador',
              accessor: (v) => v.aggregatorNames.join(', ') || '',
              defaultEnabled: true,
            },
            { key: 'gross', header: 'Bruto', accessor: (v) => v.gross, defaultEnabled: true },
            {
              key: 'commission',
              header: 'Comisión',
              accessor: (v) => v.commission,
              defaultEnabled: true,
            },
            {
              key: 'net',
              header: 'Neto a depositar',
              accessor: (v) => v.net,
              defaultEnabled: true,
            },
            { key: 'count', header: 'Cobros', accessor: (v) => v.count, defaultEnabled: true },
          ],
        }}
      />
    </section>
  )
}
