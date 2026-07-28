import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/shared/data-table/DataTable'
import { formatMoney } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/Badge'
import { formatDayLabel } from './month-grid'
import type { CalendarDay, CalendarMerchant, CalendarVenue } from './types'

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
            {/* Sin este aviso, una fila que mezcla dos afiliaciones se lee como
                un solo depósito — que es justo el error que hace imposible
                cuadrar contra lo que el proveedor mandó. */}
            {row.original.merchants.length > 1 && (
              <Badge
                tone="warn"
                size="sm"
                title="Este total mezcla varias afiliaciones. El proveedor deposita una por una — expande para ver cuánto va por cada cual."
              >
                {row.original.merchants.length} afiliaciones
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
            {
              key: 'merchants',
              header: 'Afiliaciones',
              accessor: (v) =>
                v.merchants
                  .map((m) => `${m.label}${m.affiliation ? ` (${m.affiliation})` : ''}: ${m.net}`)
                  .join(' | '),
              defaultEnabled: true,
            },
          ],
        }}
        renderExpandedRow={(venue) => <MerchantBreakdown venue={venue} />}
      />
    </section>
  )
}

/** Tasa efectiva que se le cobró a esta afiliación, para explicar netos distintos. */
function effectiveRate(m: CalendarMerchant): string | null {
  if (m.gross <= 0) return null
  return `${((m.commission / m.gross) * 100).toFixed(2)}%`
}

/**
 * Desglose por afiliación de un negocio-día.
 *
 * Existe porque el total del negocio no es depositable: el proveedor deposita
 * por afiliación. Cuando AngelPay manda $750.73 y el calendario dice $841.22, la
 * respuesta está aquí — una de las afiliaciones no cayó, o cayó en otro día
 * (`T+n` distinto), o trae otra tarifa.
 */
function MerchantBreakdown({ venue }: { venue: CalendarVenue }) {
  const { merchants } = venue

  if (merchants.length === 0) {
    return (
      <p className="text-[11.5px] text-[var(--ink-faint)]">
        Sin desglose por afiliación para este día.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10.5px] uppercase tracking-wide text-[var(--ink-faint)]">
        Desglose por afiliación · el proveedor deposita una por una
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[12px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wide text-[var(--ink-faint)]">
              <th className="py-1 pr-3 font-medium">Afiliación</th>
              <th className="py-1 pr-3 text-right font-medium">Bruto</th>
              <th className="py-1 pr-3 text-right font-medium">Comisión</th>
              <th className="py-1 pr-3 text-right font-medium">Tasa</th>
              <th className="py-1 pr-3 text-right font-medium">Neto</th>
              <th className="py-1 text-right font-medium">Cobros</th>
            </tr>
          </thead>
          <tbody>
            {merchants.map((m) => (
              <tr key={m.merchantAccountId} className="border-t border-[var(--line)]">
                <td className="py-1.5 pr-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-[var(--ink)]">{m.label}</span>
                    {m.affiliation && (
                      <span className="tabular text-[11px] text-[var(--ink-faint)]">
                        #{m.affiliation}
                      </span>
                    )}
                    {m.providerName && (
                      <Badge tone="muted" size="sm">
                        {m.providerName}
                      </Badge>
                    )}
                    {m.aggregatorName && (
                      <Badge
                        tone="muted"
                        size="sm"
                        title="El dinero pasa por un agregador antes de llegar al negocio"
                      >
                        {m.aggregatorName}
                      </Badge>
                    )}
                    {m.settlementDays !== null && (
                      <Badge tone="muted" size="sm" title="Días de liquidación de esta afiliación">
                        T+{m.settlementDays}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="tabular py-1.5 pr-3 text-right text-[var(--ink-muted)]">
                  {formatMoney(m.gross)}
                </td>
                <td className="tabular py-1.5 pr-3 text-right text-[var(--ink-muted)]">
                  −{formatMoney(m.commission)}
                </td>
                <td className="tabular py-1.5 pr-3 text-right text-[var(--ink-faint)]">
                  {effectiveRate(m) ?? '—'}
                </td>
                <td className="tabular py-1.5 pr-3 text-right font-semibold text-[var(--ink)]">
                  {formatMoney(m.net)}
                </td>
                <td className="tabular py-1.5 text-right text-[var(--ink-muted)]">{m.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
