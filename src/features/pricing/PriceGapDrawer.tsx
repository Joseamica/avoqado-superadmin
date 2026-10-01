import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/shared/ui/Button'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerSubtitle,
  DrawerTitle,
} from '@/shared/ui/Drawer'
import { DataTable } from '@/shared/data-table/DataTable'
import { QueryError } from '@/shared/components/QueryError'
import { formatDate, timezoneShort } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import {
  GAP_PAGE_SIZE,
  gapNotice,
  gapReasonLabel,
  type PriceGapSummaryRow,
  type PriceGapVenueRow,
} from './pricing-api'
import { usePriceGapVenues } from './use-pricing'

export interface GapTarget {
  name: string
  summary: PriceGapSummaryRow
}

const money = (value: string) => (
  <span className="tabular block text-right">{formatMoney(Number(value))}</span>
)

const baseColumns: ColumnDef<PriceGapVenueRow, unknown>[] = [
  {
    id: 'venue',
    header: 'Negocio',
    cell: ({ row }) => (
      <div>
        <p className="text-[var(--ink)]">{row.original.venueName}</p>
        <p className="text-[12px] text-[var(--ink-faint)]">{row.original.organizationName}</p>
      </div>
    ),
  },
  { id: 'rate', header: 'Tarifa', cell: ({ row }) => money(row.original.rate) },
  { id: 'list', header: 'Lista de hoy', cell: ({ row }) => money(row.original.listPrice) },
  { id: 'gap', header: 'Diferencia', cell: ({ row }) => money(row.original.gap) },
  {
    id: 'since',
    header: `Desde (${timezoneShort()})`,
    cell: ({ row }) => <span className="tabular">{formatDate(row.original.since)}</span>,
  },
  { id: 'reason', header: 'Motivo', cell: ({ row }) => gapReasonLabel(row.original) },
]
// The server orders by biggest gap: sorting one page in the browser would mislead.
const columns = baseColumns.map((column) => ({ ...column, enableSorting: false }))

/** «Ver quiénes»: who pays a previous rate of one function. Read only; paginated by the server. */
export function PriceGapDrawer({
  target,
  onClose,
}: {
  target: GapTarget | null
  onClose: () => void
}) {
  return (
    <Drawer open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader onClose={onClose}>
          <DrawerTitle>Tarifa anterior · {target?.name}</DrawerTitle>
          <DrawerSubtitle>
            Diferencia de tarifas, no de cobros. Sólo lectura: sus tarifas no cambian.
          </DrawerSubtitle>
        </DrawerHeader>
        <DrawerBody>{target && <GapVenues target={target} />}</DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}

function GapVenues({ target }: { target: GapTarget }) {
  const [page, setPage] = useState(1)
  const query = usePriceGapVenues(target.summary.productKey, page)
  const total = query.data?.total ?? 0
  return (
    <div className="space-y-4">
      <p className="tabular text-[14px] text-[var(--ink)]">
        {gapNotice(target.summary)}
        {query.data && total !== target.summary.venues
          ? ` · ${total} ${total === 1 ? 'contrato' : 'contratos'} de ${target.summary.venues} ${target.summary.venues === 1 ? 'negocio' : 'negocios'}`
          : ''}
      </p>
      <DataTable
        data={query.data?.items ?? []}
        columns={columns}
        searchPlaceholder="Buscar en esta página"
        minWidth={720}
        caption="Contratos que pagan menos que la lista de hoy"
        emptyState={{
          title: query.isPending
            ? 'Cargando negocios…'
            : query.isError
              ? 'La lista no está disponible'
              : 'Nadie paga menos que la lista de hoy',
          description: 'Cuentan los contratos vigentes con un periodo pagado que cubre hoy.',
        }}
      />
      {query.isError && (
        <QueryError
          error={query.error}
          context="cargar quiénes pagan una tarifa anterior"
          onRetry={() => query.refetch()}
        />
      )}
      {query.data && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-sm">
            Página {page} de {Math.max(1, Math.ceil(total / GAP_PAGE_SIZE))}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page === 1 || query.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              disabled={page * GAP_PAGE_SIZE >= total || query.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
