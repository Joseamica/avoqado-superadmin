import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/data-table/DataTable'
import { QueryError } from '@/shared/components/QueryError'
import { inspectApiError } from '@/shared/lib/api-error'
import { FEATURE_CATEGORIES } from '@/shared/lib/feature-categories'
import { formatMoney } from '@/shared/lib/money'
import { ListPriceDialog } from './ListPriceDialog'
import { PriceGapDrawer, type GapTarget } from './PriceGapDrawer'
import {
  gapNotice,
  isStale,
  pricingError,
  retryListPrice,
  setListStatus,
  type ListPriceRow,
  type PriceGapSummaryRow,
} from './pricing-api'
import { useInvalidatePricing, usePriceBoard, usePriceGaps } from './use-pricing'

const TIERS: Record<string, string> = {
  FREE: 'Gratis',
  PRO: 'Pro',
  PREMIUM: 'Premium',
  ENTERPRISE: 'Enterprise',
}
const NOT_EDITABLE: Record<NonNullable<ListPriceRow['notEditableReason']>, string> = {
  FREE: 'Incluida en Gratis',
  CONTACT: 'Se cotiza',
  SYSTEM: 'Parte del sistema',
  PLAN_PHASE_2: 'Se edita en la fase 2',
}

function Status({ row }: { row: ListPriceRow }) {
  if (row.notEditableReason)
    return <Badge tone="muted">{NOT_EDITABLE[row.notEditableReason]}</Badge>
  if (row.status === 'ACTIVE') return <Badge tone="success">En venta suelta</Badge>
  if (row.status === 'PAUSED') return <Badge tone="warn">Pausada</Badge>
  if (row.pendingPrice !== null) return <Badge tone="warn">Preparando precio…</Badge>
  return <Badge tone="muted">Sin precio</Badge>
}

const price = (value: number | null) => (
  <span className="tabular block text-right">{value === null ? '—' : formatMoney(value)}</span>
)

export default function PricingPage() {
  const board = usePriceBoard()
  const gaps = usePriceGaps()
  const invalidate = useInvalidatePricing()
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [gapTarget, setGapTarget] = useState<GapTarget | null>(null)

  const rows = board.data ?? []
  const plans = rows.filter((row) => row.planTier !== null)
  const features = rows.filter((row) => row.planTier === null)
  const gapByKey = new Map<string, PriceGapSummaryRow>(
    (gaps.data ?? []).map((gap) => [gap.productKey, gap]),
  )
  // The dialog reads the row from the board: after a stale save the refetch shows it the price that is on sale now.
  const editing = rows.find((row) => row.productKey === editingKey) ?? null

  const fail = (context: string) => (error: unknown) => {
    const { code } = pricingError(error)
    void invalidate()
    if (code === 'HYBRID_LIST_PREPARING') {
      toast.warning('Stripe todavía no confirma el precio nuevo', {
        description: 'El precio anterior se sigue vendiendo. Reintenta en unos minutos.',
      })
      return
    }
    if (isStale(code)) {
      toast.error('El precio cambió mientras lo veías', {
        description: 'Ya cargamos el estado vigente: revísalo y vuelve a intentarlo.',
      })
      return
    }
    const issue = inspectApiError(error, context)
    if (code === 'HYBRID_LIST_BREAKS_PROMOTIONS') {
      // Resuming a list under active promotions: the price dialog is where they are listed and paused.
      toast.error('Hay promociones activas que chocan con este precio', {
        description: `${issue.serverMessage ?? ''} Edita el precio para verlas y pausarlas.`.trim(),
      })
      return
    }
    toast.error(issue.title, { description: issue.serverMessage ?? issue.description })
  }
  const retry = useMutation({
    mutationFn: (row: ListPriceRow) => retryListPrice(row.productKey),
    onSuccess: (updated, row) => {
      void invalidate()
      // With nothing pending the server returns the row as it was: nothing new went on sale.
      if (updated.pendingPrice === null && updated.price === row.price)
        toast.success('Precio al día', {
          description: 'No había un precio pendiente: el que ves ya está en venta.',
        })
      else toast.success(`Precio de ${updated.name} en venta`)
    },
    onError: fail('reintentar el precio'),
  })
  const status = useMutation({
    mutationFn: ({ row, next }: { row: ListPriceRow; next: 'ACTIVE' | 'PAUSED' }) =>
      setListStatus(row, next),
    onSuccess: (row, { row: before }) => {
      void invalidate()
      // A paused list takes the «% de descuento» promotions over it off sale too (their parent is not on sale).
      const groups = (before.activeGroups ?? []).length > 0
      toast.success(
        row.status === 'PAUSED'
          ? `${row.name} ya no se vende suelta${groups ? ' y sus descuentos % dejan de venderse mientras tanto' : ''}`
          : `${row.name} vuelve a la venta suelta`,
        { description: 'Quien ya la paga conserva su precio.' },
      )
    },
    onError: fail('cambiar la venta suelta'),
  })
  const busyOn = (row: ListPriceRow) =>
    (retry.isPending && retry.variables?.productKey === row.productKey) ||
    (status.isPending && status.variables?.row.productKey === row.productKey)

  const planColumns: ColumnDef<ListPriceRow, unknown>[] = [
    { accessorKey: 'name', header: 'Plan' },
    {
      id: 'price',
      header: 'Precio vigente · IVA incluido',
      cell: ({ row }) => price(row.original.price),
    },
    { id: 'status', header: 'Edición', cell: ({ row }) => <Status row={row.original} /> },
  ]

  const featureColumns: ColumnDef<ListPriceRow, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Función',
      cell: ({ row }) => (
        <div>
          <p className="text-[var(--ink)]">{row.original.name}</p>
          <p className="text-[12px] text-[var(--ink-faint)]">
            {FEATURE_CATEGORIES[row.original.category] ?? row.original.category}
          </p>
        </div>
      ),
    },
    {
      id: 'tier',
      header: 'Plan que la incluye',
      enableSorting: false,
      cell: ({ row }) => (row.original.minimumTier ? TIERS[row.original.minimumTier] : '—'),
    },
    {
      id: 'price',
      header: 'Lista mensual · IVA incluido',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="space-y-1.5">
          {price(row.original.price)}
          {row.original.pendingPrice !== null && (
            <div className="flex flex-col items-end gap-1">
              <span className="tabular text-[12px] text-[var(--warn)]">
                {`Precio nuevo pendiente: ${formatMoney(row.original.pendingPrice)}`}
              </span>
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Reintentar precio de ${row.original.name}`}
                disabled={busyOn(row.original)}
                onClick={() => retry.mutate(row.original)}
              >
                Reintentar
              </Button>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      enableSorting: false,
      cell: ({ row }) => <Status row={row.original} />,
    },
    {
      id: 'gap',
      header: 'Tarifa anterior',
      enableSorting: false,
      cell: ({ row }) => {
        const gap = gapByKey.get(row.original.productKey)
        if (!gap || (!gap.venues && !gap.aboveListVenues && !gap.bundleVenues))
          return <span className="text-[var(--ink-faint)]">—</span>
        return (
          <div className="space-y-1 text-[12.5px]">
            {gap.venues > 0 && (
              <>
                <p className="tabular text-[var(--ink)]">{gapNotice(gap)}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Ver quiénes pagan tarifa anterior de ${row.original.name}`}
                  onClick={() => setGapTarget({ name: row.original.name, summary: gap })}
                >
                  Ver quiénes
                </Button>
              </>
            )}
            {gap.aboveListVenues > 0 && (
              <p className="tabular text-[var(--ink-muted)]">
                {`${gap.aboveListVenues} ${gap.aboveListVenues === 1 ? 'negocio paga' : 'negocios pagan'} más que la lista de hoy`}
              </p>
            )}
            {gap.bundleVenues > 0 && (
              <p className="tabular text-[var(--ink-muted)]">
                {`En paquetes: ${gap.bundleVenues} ${gap.bundleVenues === 1 ? 'negocio' : 'negocios'}`}
              </p>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Acciones</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original
        if (!item.editable) return null
        return (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              aria-label={`Editar precio de ${item.name}`}
              onClick={() => setEditingKey(item.productKey)}
            >
              Editar precio
            </Button>
            {item.status && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busyOn(item)}
                aria-label={`${item.status === 'ACTIVE' ? 'Pausar' : 'Reanudar'} venta suelta de ${item.name}`}
                onClick={() =>
                  status.mutate({ row: item, next: item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })
                }
              >
                {item.status === 'ACTIVE' ? 'Pausar' : 'Reanudar'}
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const loadingState = {
    title: board.isPending
      ? 'Cargando precios…'
      : board.isError
        ? 'Los precios no están disponibles'
        : 'Sin productos',
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      <header>
        <h1 className="display">Precios</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--ink-muted)]">
          Precio de lista mensual de cada función para venderla suelta, en pesos MXN con IVA
          incluido. Cambiarlo aplica a las contrataciones que vengan: quien ya la paga conserva su
          precio.
        </p>
      </header>
      {board.isError && (
        <QueryError
          error={board.error}
          context="cargar los precios"
          onRetry={() => board.refetch()}
        />
      )}
      <section className="space-y-3" aria-labelledby="pricing-plans">
        <h2 id="pricing-plans" className="eyebrow">
          Planes
        </h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Sólo lectura: el precio de Pro y Premium se edita en la fase 2.
        </p>
        <DataTable
          data={plans}
          columns={planColumns}
          searchPlaceholder="Buscar plan"
          caption="Precio vigente de los planes"
          minWidth={560}
          emptyState={loadingState}
        />
      </section>
      <section className="space-y-3" aria-labelledby="pricing-features">
        <h2 id="pricing-features" className="eyebrow">
          Funciones
        </h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Las funciones incluidas en Gratis, las que se cotizan y las del sistema no tienen precio
          suelto.
        </p>
        {gaps.isError && (
          <QueryError
            error={gaps.error}
            context="cargar quiénes pagan una tarifa anterior"
            onRetry={() => gaps.refetch()}
          />
        )}
        <DataTable
          data={features}
          columns={featureColumns}
          searchPlaceholder="Buscar función"
          caption="Precio de lista de cada función"
          minWidth={1040}
          emptyState={loadingState}
        />
      </section>
      <ListPriceDialog row={editing} onClose={() => setEditingKey(null)} />
      <PriceGapDrawer target={gapTarget} onClose={() => setGapTarget(null)} />
    </div>
  )
}
