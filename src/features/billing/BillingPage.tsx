import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Eye, FilePlus2, RotateCcw, Settings2, Trash2 } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { buttonVariants } from '@/shared/ui/button-variants'
import { IconButton } from '@/shared/ui/IconButton'
import { DataTable } from '@/shared/data-table/DataTable'
import { FilterPill, MultiSelectFilterContent, type MultiSelectOption } from '@/shared/filters'
import { QueryError } from '@/shared/components/QueryError'
import { formatDate } from '@/shared/lib/datetime'
import { useEmisor, useInvoices, useInvoiceActions } from './use-billing'
import { formatCents } from './catalogs'
import { NewInvoiceDrawer } from './NewInvoiceDrawer'
import { InvoiceDetailDrawer } from './InvoiceDetailDrawer'
import {
  CFDI_STATUS_TONE,
  humanizeCfdiStatus,
  PAYMENT_STATE_LABEL,
  PAYMENT_STATE_TONE,
  paymentState,
  type PlatformCfdi,
  type PlatformCfdiStatus,
} from './types'

const NUM = new Intl.NumberFormat('es-MX')

const STATUS_OPTIONS: MultiSelectOption<PlatformCfdiStatus>[] = [
  { value: 'STAMPED', label: 'Timbrada' },
  { value: 'CANCELLED', label: 'Cancelada' },
  { value: 'STAMP_FAILED', label: 'Error al timbrar' },
  { value: 'DRAFT', label: 'Borrador' },
]

export function BillingPage() {
  const emisor = useEmisor()
  const invoices = useInvoices({})
  const [statuses, setStatuses] = useState<Set<PlatformCfdiStatus>>(new Set())
  const [newOpen, setNewOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [retryInvoice, setRetryInvoice] = useState<PlatformCfdi | null>(null)
  const { discard } = useInvoiceActions()
  const discardMutate = discard.mutate

  const handleRetry = useCallback((cfdi: PlatformCfdi) => {
    setRetryInvoice(cfdi)
    setNewOpen(true)
  }, [])
  const handleDiscard = useCallback(
    (cfdi: PlatformCfdi) => {
      if (
        window.confirm(
          `¿Descartar la factura fallida de ${cfdi.receptorNombre}? Esta acción no se puede deshacer.`,
        )
      ) {
        discardMutate(cfdi.id)
      }
    },
    [discardMutate],
  )

  const rows = useMemo(() => invoices.data?.rows ?? [], [invoices.data])
  const filtered = useMemo(
    () => (statuses.size > 0 ? rows.filter((r) => statuses.has(r.status)) : rows),
    [rows, statuses],
  )

  const kpis = useMemo(() => {
    const stamped = rows.filter((r) => r.status === 'STAMPED')
    const billedCents = stamped.reduce((sum, r) => sum + r.totalCents, 0)
    const pendingPpd = rows.filter((r) => paymentState(r) === 'PENDING').length
    return { stampedCount: stamped.length, billedCents, pendingPpd }
  }, [rows])

  const emisorReady = emisor.data && emisor.data.csdStatus === 'ACTIVE'

  const columns = useMemo<ColumnDef<PlatformCfdi, unknown>[]>(
    () => [
      {
        id: 'receptor',
        header: 'Receptor',
        accessorFn: (r) => `${r.receptorNombre} ${r.receptorRfc}`,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]">
              {row.original.receptorNombre}
            </p>
            <p className="tabular truncate text-[10.5px] text-[var(--ink-faint)]">
              {row.original.receptorRfc}
            </p>
          </div>
        ),
      },
      {
        id: 'comprobante',
        header: 'Comprobante',
        accessorFn: (r) => r.uuid ?? r.id,
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="min-w-0">
              <p className="tabular text-[12.5px] text-[var(--ink)]">
                {c.serie ?? '—'}
                {c.folio ?? ''}{' '}
                {c.type === 'PAGO' && (
                  <Badge tone="info" size="sm">
                    REP
                  </Badge>
                )}
              </p>
              <p className="tabular truncate text-[10px] text-[var(--ink-faint)]">
                {c.uuid ?? 'sin timbre'}
              </p>
            </div>
          )
        },
      },
      {
        id: 'status',
        header: 'Estado',
        accessorFn: (r) => r.status,
        cell: ({ row }) => (
          <Badge tone={CFDI_STATUS_TONE[row.original.status]}>
            {humanizeCfdiStatus(row.original.status)}
          </Badge>
        ),
      },
      {
        id: 'metodo',
        header: 'Método',
        accessorFn: (r) => r.metodoPago,
        cell: ({ row }) => (
          <Badge tone="muted" size="sm">
            {row.original.metodoPago}
          </Badge>
        ),
      },
      {
        id: 'pago',
        header: 'Pago PPD',
        accessorFn: (r) => paymentState(r),
        cell: ({ row }) => {
          const st = paymentState(row.original)
          if (st === 'NA') return <span className="text-[var(--ink-faint)]">—</span>
          return (
            <Badge tone={PAYMENT_STATE_TONE[st]} size="sm">
              {PAYMENT_STATE_LABEL[st]}
            </Badge>
          )
        },
      },
      {
        id: 'total',
        header: () => <span className="block text-right">Total</span>,
        accessorFn: (r) => r.totalCents,
        cell: ({ row }) => (
          <p className="tabular text-right text-[13px] font-semibold">
            {formatCents(row.original.totalCents)}
          </p>
        ),
        sortingFn: 'basic',
      },
      {
        id: 'fecha',
        header: 'Fecha',
        accessorFn: (r) => r.stampedAt ?? r.createdAt,
        cell: ({ row }) => (
          <span className="tabular text-[12px]">
            {formatDate(row.original.stampedAt ?? row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="block text-right">Acciones</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="flex justify-end gap-1">
              {c.status === 'STAMP_FAILED' && (
                <>
                  <IconButton
                    size="sm"
                    aria-label={`Reintentar factura de ${c.receptorNombre}`}
                    title="Reintentar"
                    onClick={() => handleRetry(c)}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label={`Descartar factura fallida de ${c.receptorNombre}`}
                    title="Descartar"
                    onClick={() => handleDiscard(c)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </IconButton>
                </>
              )}
              <IconButton
                size="sm"
                aria-label={`Ver CFDI de ${c.receptorNombre}`}
                title="Ver"
                onClick={() => setDetailId(c.id)}
              >
                <Eye className="h-4 w-4" aria-hidden />
              </IconButton>
            </div>
          )
        },
      },
    ],
    [handleRetry, handleDiscard],
  )

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Facturación</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            Facturas CFDI
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            CFDIs que Avoqado emite a sus propios clientes (mensualidad, setup, TPV).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/billing/emisor"
            className={buttonVariants({ variant: 'secondary', size: 'md' })}
          >
            <Settings2 className="h-4 w-4" aria-hidden /> Configurar emisor
          </Link>
          <Button
            onClick={() => {
              setRetryInvoice(null)
              setNewOpen(true)
            }}
            disabled={!emisorReady}
          >
            <FilePlus2 className="h-4 w-4" aria-hidden /> Nueva factura
          </Button>
        </div>
      </header>

      {!emisor.isLoading && !emisorReady && (
        <div className="mb-6 flex items-start gap-3 rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas-raised)] p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warn)]" aria-hidden />
          <div className="text-[13px]">
            <p className="font-semibold text-[var(--ink)]">
              El emisor de Avoqado aún no está listo para timbrar
            </p>
            <p className="mt-0.5 text-[var(--ink-muted)]">
              {emisor.data
                ? 'Falta cargar el CSD (sello digital).'
                : 'Falta capturar los datos fiscales del emisor.'}{' '}
              <Link
                to="/billing/emisor"
                className="text-[var(--info)] underline-offset-2 hover:underline"
              >
                Configurar emisor
              </Link>
            </p>
          </div>
        </div>
      )}

      {invoices.isError && (
        <QueryError
          className="mb-5"
          error={invoices.error}
          context="cargar las facturas"
          onRetry={() => invoices.refetch()}
        />
      )}

      <section
        aria-label="Resumen de facturación"
        className="mb-8 flex flex-col gap-px overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--line)] sm:flex-row"
      >
        <article className="flex-[2] bg-[var(--canvas)] p-5">
          <p className="eyebrow">Total facturado</p>
          <p className="mt-2.5 font-display tabular text-[32px] font-semibold text-[var(--ink)]">
            {formatCents(kpis.billedCents)}
          </p>
          <p className="mt-3 text-[12px] text-[var(--ink-muted)]">
            {NUM.format(kpis.stampedCount)} CFDIs timbrados
          </p>
        </article>
        <article className="flex-1 bg-[var(--canvas)] p-4">
          <p className="eyebrow">Timbradas</p>
          <p className="mt-2.5 font-display tabular text-[22px] font-semibold text-[var(--ink)]">
            {NUM.format(kpis.stampedCount)}
          </p>
        </article>
        <article className="flex-1 bg-[var(--canvas)] p-4">
          <p className="eyebrow">PPD por cobrar</p>
          <p className="mt-2.5 font-display tabular text-[22px] font-semibold text-[var(--ink)]">
            {NUM.format(kpis.pendingPpd)}
          </p>
        </article>
      </section>

      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder="Buscar por receptor o RFC…"
        caption={`Tabla de ${filtered.length} facturas.`}
        initialSorting={[{ id: 'fecha', desc: true }]}
        pageSize={25}
        toolbar={
          <FilterPill
            label="Estado"
            activeCount={statuses.size}
            onClear={() => setStatuses(new Set())}
          >
            <MultiSelectFilterContent
              title="Estado del CFDI"
              options={STATUS_OPTIONS}
              selected={statuses}
              onApply={setStatuses}
            />
          </FilterPill>
        }
        emptyState={{
          title: invoices.isLoading ? 'Cargando…' : 'Sin facturas',
          description: 'Los CFDIs que emitas a tus clientes aparecerán aquí.',
        }}
      />

      <NewInvoiceDrawer
        open={newOpen}
        onOpenChange={(v) => {
          setNewOpen(v)
          if (!v) setRetryInvoice(null)
        }}
        defaultSerie={emisor.data?.serie ?? 'A'}
        retryFrom={retryInvoice}
      />
      <InvoiceDetailDrawer invoiceId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
