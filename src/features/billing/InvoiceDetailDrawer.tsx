import { useState } from 'react'
import { toast } from 'sonner'
import { Download, FileX2 } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Combobox } from '@/shared/ui/Combobox'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerSubtitle,
  DrawerTitle,
} from '@/shared/ui/Drawer'
import { QueryError } from '@/shared/components/QueryError'
import { inspectApiError } from '@/shared/lib/api-error'
import { formatDateTime } from '@/shared/lib/datetime'
import { downloadInvoiceArtifact } from './api'
import { useInvoice, useInvoiceActions } from './use-billing'
import { formatCents } from './catalogs'
import {
  CFDI_STATUS_TONE,
  humanizeCfdiStatus,
  PAYMENT_STATE_LABEL,
  PAYMENT_STATE_TONE,
  paymentState,
} from './types'

const MOTIVO_OPTIONS = [
  { value: '02', label: '02 · Comprobante con errores sin relación' },
  { value: '03', label: '03 · No se llevó a cabo la operación' },
  { value: '01', label: '01 · Con errores con relación (requiere sustituto)' },
  { value: '04', label: '04 · Operación nominativa en factura global' },
]

export function InvoiceDetailDrawer({
  invoiceId,
  onClose,
}: {
  invoiceId: string | null
  onClose: () => void
}) {
  const query = useInvoice(invoiceId)
  const { cancel } = useInvoiceActions()
  const [downloading, setDownloading] = useState<'pdf' | 'xml' | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [motivo, setMotivo] = useState('02')
  const [substituteUuid, setSubstituteUuid] = useState('')

  const cfdi = query.data

  async function handleDownload(kind: 'pdf' | 'xml') {
    if (!invoiceId) return
    setDownloading(kind)
    try {
      await downloadInvoiceArtifact(invoiceId, kind)
    } catch (e) {
      const i = inspectApiError(e, `descargar el ${kind.toUpperCase()}`)
      toast.error(i.title, { description: i.description })
    } finally {
      setDownloading(null)
    }
  }

  function handleCancel() {
    if (!invoiceId) return
    if (motivo === '01' && !substituteUuid.trim()) {
      toast.error('Falta el UUID que sustituye', {
        description: 'El motivo 01 requiere el folio fiscal del CFDI que sustituye.',
      })
      return
    }
    cancel.mutate(
      {
        id: invoiceId,
        motivo: motivo as '01' | '02' | '03' | '04',
        substituteUuid: substituteUuid.trim() || undefined,
      },
      { onSuccess: () => setCancelOpen(false) },
    )
  }

  const payState = cfdi ? paymentState(cfdi) : 'NA'

  return (
    <Drawer open={Boolean(invoiceId)} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Detalle del CFDI</DrawerTitle>
          <DrawerSubtitle>{cfdi?.uuid ?? cfdi?.id ?? ''}</DrawerSubtitle>
        </DrawerHeader>
        <DrawerBody>
          {query.isError && (
            <QueryError
              error={query.error}
              context="cargar el CFDI"
              onRetry={() => query.refetch()}
            />
          )}
          {query.isLoading && <p className="text-[13px] text-[var(--ink-muted)]">Cargando…</p>}

          {cfdi && (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <Badge tone={CFDI_STATUS_TONE[cfdi.status]}>
                  {humanizeCfdiStatus(cfdi.status)}
                </Badge>
                <Badge tone="muted" size="sm">
                  {cfdi.metodoPago}
                </Badge>
                {cfdi.type === 'PAGO' && (
                  <Badge tone="info" size="sm">
                    Complemento de pago
                  </Badge>
                )}
                {payState !== 'NA' && (
                  <Badge tone={PAYMENT_STATE_TONE[payState]} size="sm">
                    {PAYMENT_STATE_LABEL[payState]}
                  </Badge>
                )}
              </div>

              {/* Receptor */}
              <section className="mb-5">
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  Receptor
                </h3>
                <p className="text-[14px] font-semibold text-[var(--ink)]">{cfdi.receptorNombre}</p>
                <p className="tabular text-[12px] text-[var(--ink-muted)]">
                  {cfdi.receptorRfc} · {cfdi.receptorRegimen} · CP {cfdi.receptorCp} · Uso{' '}
                  {cfdi.usoCfdi}
                </p>
              </section>

              {/* Conceptos */}
              <section className="mb-5">
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  Conceptos
                </h3>
                <div className="overflow-hidden rounded-[6px] border border-[var(--line)]">
                  {(cfdi.lines ?? []).map((l, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2 text-[12.5px] last:border-0"
                    >
                      <span className="min-w-0 truncate text-[var(--ink)]">
                        {l.quantity} × {l.description}
                      </span>
                      <span className="tabular shrink-0 pl-3 text-[var(--ink-muted)]">
                        {formatCents(Math.round(l.quantity * l.unitPriceCents))}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Totales */}
              <section className="mb-5">
                <dl className="space-y-1.5 text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-[var(--ink-muted)]">Subtotal</dt>
                    <dd className="tabular text-[var(--ink)]">
                      {formatCents(cfdi.subtotalCents - cfdi.discountCents)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--ink-muted)]">IVA</dt>
                    <dd className="tabular text-[var(--ink)]">{formatCents(cfdi.taxCents)}</dd>
                  </div>
                  <div className="flex justify-between text-[15px]">
                    <dt className="font-semibold text-[var(--ink)]">Total</dt>
                    <dd className="tabular font-semibold text-[var(--ink)]">
                      {formatCents(cfdi.totalCents)}
                    </dd>
                  </div>
                  {payState !== 'NA' && (
                    <div className="flex justify-between">
                      <dt className="text-[var(--ink-muted)]">Pagado</dt>
                      <dd className="tabular text-[var(--ink)]">
                        {formatCents(cfdi.amountPaidCents)}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Meta */}
              <section className="mb-6 grid grid-cols-2 gap-y-2 text-[12px]">
                <span className="text-[var(--ink-muted)]">Serie · Folio</span>
                <span className="tabular text-right text-[var(--ink)]">
                  {cfdi.serie ?? '—'}
                  {cfdi.folio ?? ''}
                </span>
                <span className="text-[var(--ink-muted)]">Forma de pago</span>
                <span className="tabular text-right text-[var(--ink)]">{cfdi.formaPago}</span>
                <span className="text-[var(--ink-muted)]">Timbrado</span>
                <span className="tabular text-right text-[var(--ink)]">
                  {cfdi.stampedAt ? formatDateTime(cfdi.stampedAt) : '—'}
                </span>
              </section>

              {/* Acciones */}
              {cfdi.status === 'STAMPED' && (
                <section className="border-t border-[var(--line)] pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload('pdf')}
                      disabled={downloading !== null}
                    >
                      <Download className="h-4 w-4" aria-hidden />{' '}
                      {downloading === 'pdf' ? 'Descargando…' : 'PDF'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload('xml')}
                      disabled={downloading !== null}
                    >
                      <Download className="h-4 w-4" aria-hidden />{' '}
                      {downloading === 'xml' ? 'Descargando…' : 'XML'}
                    </Button>
                    {!cancelOpen && (
                      <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
                        <FileX2 className="h-4 w-4" aria-hidden /> Cancelar CFDI
                      </Button>
                    )}
                  </div>

                  {cancelOpen && (
                    <div className="mt-4 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas-raised)] p-4">
                      <p className="mb-3 text-[13px] font-semibold text-[var(--ink)]">
                        Cancelar este CFDI
                      </p>
                      <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-muted)]">
                        Motivo
                      </label>
                      <Combobox
                        value={motivo}
                        onChange={setMotivo}
                        options={MOTIVO_OPTIONS}
                        ariaLabel="Motivo de cancelación"
                      />
                      {motivo === '01' && (
                        <div className="mt-3">
                          <Field
                            label="UUID que sustituye"
                            name="substitute"
                            value={substituteUuid}
                            onChange={(e) => setSubstituteUuid(e.target.value)}
                            hint="Folio fiscal del CFDI que reemplaza a éste."
                          />
                        </div>
                      )}
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={handleCancel}
                          disabled={cancel.isPending}
                        >
                          {cancel.isPending ? 'Cancelando…' : 'Confirmar cancelación'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCancelOpen(false)}
                          disabled={cancel.isPending}
                        >
                          Volver
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
