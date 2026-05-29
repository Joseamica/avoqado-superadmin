import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ExternalLink, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { QueryError } from '@/shared/components/QueryError'
import { inspectApiError } from '@/shared/lib/api-error'
import { DEFAULT_TIMEZONE, formatDateTime, timezoneShort } from '@/shared/lib/datetime'
import { cn } from '@/shared/lib/utils'
import { useAssignSerials, useMarkDelivered, useMarkShipped, useTpvOrder } from './use-tpv-orders'
import {
  FULFILLMENT_STATUS_TONE,
  PAYMENT_METHOD_TONE,
  PAYMENT_STATUS_TONE,
  canMarkDelivered,
  canMarkShipped,
  formatMxnCents,
  humanizeFulfillmentStatus,
  humanizePaymentMethod,
  humanizePaymentStatus,
  needsSerialsAssignment,
  totalUnits,
  type TerminalOrder,
  type TerminalOrderItem,
} from './types'

interface UnitDraft {
  name: string
  serial: string
}
type DraftUnits = Record<string, UnitDraft[]>

function initialDraft(items: TerminalOrderItem[]): DraftUnits {
  const draft: DraftUnits = {}
  for (const item of items) {
    draft[item.id] = Array.from({ length: item.quantity }, (_, i) => ({
      name: `${item.namePrefix} ${i + 1}`,
      serial: '',
    }))
  }
  return draft
}

export function TpvOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const query = useTpvOrder(id)
  const order = query.data ?? null

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <Link
        to="/tpv-orders"
        className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Pedidos TPV
      </Link>

      {query.isError && (
        <QueryError
          className="mb-5"
          error={query.error}
          context="cargar el pedido"
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      {!order && query.isLoading && (
        <p className="text-[13px] text-[var(--ink-faint)]">Cargando pedido…</p>
      )}

      {order && <OrderContent order={order} />}
    </div>
  )
}

function OrderContent({ order }: { order: TerminalOrder }) {
  const showAssign = needsSerialsAssignment(order)
  const showShip = canMarkShipped(order)
  const showDeliver = canMarkDelivered(order)

  return (
    <>
      <header className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="eyebrow">Pedido TPV</p>
          <h1 className="mt-1.5 font-display tabular text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            {order.orderNumber}
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            <Link
              to={`/venues/${order.venueId}`}
              className="hover:text-[var(--ink)] hover:underline"
            >
              {order.venue.name}
            </Link>{' '}
            · {totalUnits(order)} unidades ·{' '}
            <span className="tabular">{formatMxnCents(order.totalCents, order.currency)}</span>
            <span className="tabular ml-2 text-[var(--ink-faint)]">
              · creado {formatDateTime(order.createdAt)} ({timezoneShort(DEFAULT_TIMEZONE)})
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={PAYMENT_METHOD_TONE[order.paymentMethod]}>
            {humanizePaymentMethod(order.paymentMethod)}
          </Badge>
          <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>
            {humanizePaymentStatus(order.paymentStatus)}
          </Badge>
          <Badge tone={FULFILLMENT_STATUS_TONE[order.fulfillmentStatus]}>
            {humanizeFulfillmentStatus(order.fulfillmentStatus)}
          </Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-6">
          <ItemsCard order={order} />
          {showAssign && <AssignSerialsCard order={order} />}
          {order.terminals && order.terminals.length > 0 && <TerminalsCard order={order} />}
          {showShip && <MarkShippedCard order={order} />}
          {showDeliver && <MarkDeliveredCard order={order} />}
        </div>
        <aside className="space-y-6">
          <ContactCard order={order} />
          <ShippingCard order={order} />
          <PaymentCard order={order} />
        </aside>
      </div>
    </>
  )
}

/* --- Cards --- */

function Section({
  title,
  children,
  description,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)] p-5">
      <div className="mb-4">
        <h2 className="font-display text-[15px] font-semibold tracking-[-0.012em] text-[var(--ink)]">
          {title}
        </h2>
        {description && <p className="mt-1 text-[12.5px] text-[var(--ink-muted)]">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function ItemsCard({ order }: { order: TerminalOrder }) {
  return (
    <Section title="Items" description={`${totalUnits(order)} unidades en total.`}>
      <ul className="divide-y divide-[var(--line)]">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4 py-3 first:pt-0">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[var(--ink)]">
                {item.productName}
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--ink-faint)]">
                {item.brand} {item.model}
              </p>
            </div>
            <div className="flex items-center gap-5">
              <span className="tabular text-[12.5px] text-[var(--ink-muted)]">
                ×{item.quantity}
              </span>
              <span className="tabular text-right text-[13px] font-medium text-[var(--ink)]">
                {formatMxnCents(item.unitPriceCents * item.quantity, order.currency)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-1 border-t border-[var(--line)] pt-4 text-[12.5px]">
        <div className="flex justify-between text-[var(--ink-muted)]">
          <span>Subtotal</span>
          <span className="tabular">{formatMxnCents(order.subtotalCents, order.currency)}</span>
        </div>
        <div className="flex justify-between text-[var(--ink-muted)]">
          <span>Impuestos</span>
          <span className="tabular">{formatMxnCents(order.taxCents, order.currency)}</span>
        </div>
        <div className="flex justify-between pt-1 text-[14px] font-semibold text-[var(--ink)]">
          <span>Total</span>
          <span className="tabular">{formatMxnCents(order.totalCents, order.currency)}</span>
        </div>
      </div>
    </Section>
  )
}

function AssignSerialsCard({ order }: { order: TerminalOrder }) {
  const [draft, setDraft] = useState<DraftUnits>(() => initialDraft(order.items))
  const mutation = useAssignSerials(order.id)

  // Si la orden cambia (refetch tras submit), re-init.
  useEffect(() => {
    setDraft(initialDraft(order.items))
  }, [order.id, order.items])

  const allFilled = useMemo(
    () =>
      Object.values(draft).every((units) => units.every((u) => u.name.trim() && u.serial.trim())),
    [draft],
  )

  const handleSubmit = () => {
    const items = Object.entries(draft).map(([orderItemId, units]) => ({
      orderItemId,
      units: units.map((u) => ({ name: u.name.trim(), serial: u.serial.trim() })),
    }))
    mutation.mutate(
      { items },
      {
        onSuccess: () => {
          toast.success('Serials asignados', {
            description:
              'Se enviaron los códigos de activación al cliente y los terminales aparecen ya en su dashboard.',
          })
        },
        onError: (err) => {
          const info = inspectApiError(err, 'asignar los serials')
          toast.error(info.title, { description: info.description })
        },
      },
    )
  }

  return (
    <Section
      title="Asignar serials"
      description="Una fila por unidad. Llena el nombre y el serial físico del PAX/PRINTER/KDS. Al guardar se crean los Terminals en el venue y se envía email al cliente con los códigos de activación."
    >
      <div className="space-y-5">
        {order.items.map((item) => (
          <div key={item.id} className="space-y-3">
            <h3 className="text-[12.5px] font-semibold text-[var(--ink)]">
              {item.productName} <span className="text-[var(--ink-faint)]">× {item.quantity}</span>
            </h3>
            <div className="space-y-2">
              {(draft[item.id] ?? []).map((unit, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Field
                    label={`Unidad ${idx + 1} — nombre`}
                    value={unit.name}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [item.id]: prev[item.id].map((u, i) =>
                          i === idx ? { ...u, name: e.target.value } : u,
                        ),
                      }))
                    }
                  />
                  <Field
                    label="Serial físico"
                    placeholder="Ej. A910S-2026-001234"
                    value={unit.serial}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [item.id]: prev[item.id].map((u, i) =>
                          i === idx ? { ...u, serial: e.target.value } : u,
                        ),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <Button
          type="button"
          size="lg"
          onClick={handleSubmit}
          disabled={!allFilled || mutation.isPending}
          className="w-full sm:w-auto"
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {mutation.isPending ? 'Asignando…' : 'Asignar y notificar al cliente'}
        </Button>
      </div>
    </Section>
  )
}

function TerminalsCard({ order }: { order: TerminalOrder }) {
  if (!order.terminals || order.terminals.length === 0) return null
  return (
    <Section
      title="Terminales creadas"
      description="Resultado de la asignación de serials. Estos terminals ya viven en el catálogo del venue."
    >
      <ul className="divide-y divide-[var(--line)]">
        {order.terminals.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[var(--ink)]">{t.name}</p>
              <p className="tabular mt-0.5 font-mono text-[11px] text-[var(--ink-faint)]">
                {t.serialNumber ?? 'Sin serial'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {t.activationCode && (
                <span className="tabular rounded-[4px] bg-[var(--canvas-sunken)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
                  {t.activationCode}
                </span>
              )}
              <Link
                to={`/terminals/${t.id}/settings`}
                aria-label={`Abrir terminal ${t.name}`}
                className="text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function MarkShippedCard({ order }: { order: TerminalOrder }) {
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState('')
  const mutation = useMarkShipped(order.id)

  const handleSubmit = () => {
    if (!trackingNumber.trim() || !carrier.trim()) return
    mutation.mutate(
      { trackingNumber: trackingNumber.trim(), carrier: carrier.trim() },
      {
        onSuccess: () => {
          toast.success('Pedido marcado como enviado', {
            description: 'Se notificó al cliente con el número de guía.',
          })
          setTrackingNumber('')
          setCarrier('')
        },
        onError: (err) => {
          const info = inspectApiError(err, 'marcar como enviado')
          toast.error(info.title, { description: info.description })
        },
      },
    )
  }

  const canSubmit = trackingNumber.trim().length > 0 && carrier.trim().length > 0
  return (
    <Section
      title="Marcar como enviado"
      description="Captura el número de guía y la paquetería para notificar al cliente."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field
          label="Número de guía"
          placeholder="Ej. 1Z999AA10123456784"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
        />
        <Field
          label="Paquetería"
          placeholder="Ej. DHL, Estafeta, FedEx"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
        />
      </div>
      <Button
        type="button"
        size="lg"
        onClick={handleSubmit}
        disabled={!canSubmit || mutation.isPending}
        className="mt-4 w-full sm:w-auto"
      >
        <Truck className="h-3.5 w-3.5" aria-hidden />
        {mutation.isPending ? 'Marcando…' : 'Marcar como enviado'}
      </Button>
    </Section>
  )
}

function MarkDeliveredCard({ order }: { order: TerminalOrder }) {
  const mutation = useMarkDelivered(order.id)

  const handleSubmit = () => {
    mutation.mutate(undefined, {
      onSuccess: () => {
        toast.success('Pedido marcado como entregado')
      },
      onError: (err) => {
        const info = inspectApiError(err, 'marcar como entregado')
        toast.error(info.title, { description: info.description })
      },
    })
  }

  return (
    <Section
      title="Marcar como entregado"
      description="Confirma que el cliente ya recibió el paquete físicamente."
    >
      <Button
        type="button"
        size="lg"
        onClick={handleSubmit}
        disabled={mutation.isPending}
        className="w-full sm:w-auto"
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        {mutation.isPending ? 'Marcando…' : 'Marcar como entregado'}
      </Button>
    </Section>
  )
}

function ContactCard({ order }: { order: TerminalOrder }) {
  return (
    <Section title="Contacto">
      <dl className="space-y-2 text-[12.5px]">
        <Row label="Nombre" value={order.contactName} />
        <Row
          label="Email"
          value={
            <a
              href={`mailto:${order.contactEmail}`}
              className="hover:text-[var(--ink)] hover:underline"
            >
              {order.contactEmail}
            </a>
          }
        />
        <Row label="Teléfono" value={order.contactPhone || '—'} />
      </dl>
    </Section>
  )
}

function ShippingCard({ order }: { order: TerminalOrder }) {
  return (
    <Section title="Dirección de envío">
      <address className="text-[12.5px] not-italic text-[var(--ink-muted)]">
        <p className="text-[var(--ink)]">{order.shippingAddress}</p>
        {order.shippingAddress2 && <p>{order.shippingAddress2}</p>}
        <p>
          {order.shippingCity}, {order.shippingState} {order.shippingZip}
        </p>
        <p>{order.shippingCountry}</p>
      </address>
    </Section>
  )
}

function PaymentCard({ order }: { order: TerminalOrder }) {
  return (
    <Section title="Pago">
      <dl className="space-y-2 text-[12.5px]">
        <Row
          label="Método"
          value={
            <Badge tone={PAYMENT_METHOD_TONE[order.paymentMethod]}>
              {humanizePaymentMethod(order.paymentMethod)}
            </Badge>
          }
        />
        <Row
          label="Estado"
          value={
            <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>
              {humanizePaymentStatus(order.paymentStatus)}
            </Badge>
          }
        />
        {order.stripeReceiptUrl && (
          <Row
            label="Recibo Stripe"
            value={
              <a
                href={order.stripeReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
              >
                Ver recibo
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            }
          />
        )}
        {order.speiProofUrl && (
          <Row
            label="Comprobante SPEI"
            value={
              <a
                href={order.speiProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
              >
                Ver comprobante
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            }
          />
        )}
        {order.speiRejectionReason && (
          <div className="mt-2 rounded-[4px] border border-[var(--danger)]/30 bg-[var(--danger-faint)] p-2 text-[11.5px] text-[var(--danger)]">
            <p className="font-semibold">Motivo de rechazo</p>
            <p className="mt-0.5 text-[var(--ink-muted)]">{order.speiRejectionReason}</p>
          </div>
        )}
      </dl>
    </Section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={cn('grid grid-cols-[110px_1fr] items-baseline gap-3')}>
      <dt className="text-[var(--ink-faint)]">{label}</dt>
      <dd className="text-[var(--ink)]">{value}</dd>
    </div>
  )
}
