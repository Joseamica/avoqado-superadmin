import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, AlertTriangle, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { QueryError } from '@/shared/components/QueryError'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  useProviderBlockers,
  useRemoveEcommerceMerchant,
  useForceDeletePaymentProvider,
  useDeletePaymentProvider,
} from './use-payment-providers'
import { MerchantBlockerRow } from './MerchantBlockerRow'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerId: string
  providerName: string
  onDeleted: () => void
}

/**
 * Borrado guiado de un payment provider: muestra qué lo bloquea, deja quitar las
 * dependencias removibles (merchants, canales e-commerce) y, cuando ya no queda
 * nada, hace el borrado REAL. Lo que es historial (webhooks, logs, costos) se
 * muestra como no-removible.
 */
export function ProviderDeleteDialog({
  open,
  onOpenChange,
  providerId,
  providerName,
  onDeleted,
}: Props) {
  const blockersQ = useProviderBlockers(providerId, open)
  const removeEcommerce = useRemoveEcommerceMerchant(providerId)
  const forceDelete = useForceDeletePaymentProvider()
  const deactivate = useDeletePaymentProvider()
  const [removingId, setRemovingId] = useState<string | null>(null)

  const b = blockersQ.data

  function handleRemoveEcommerce(id: string, label: string) {
    setRemovingId(id)
    removeEcommerce.mutate(id, {
      onSuccess: () => {
        toast.success(`Canal e-commerce "${label}" quitado`)
        setRemovingId(null)
      },
      onError: (err) => {
        const i = inspectApiError(err, 'quitar el canal e-commerce')
        toast.error(i.title, { description: i.description })
        setRemovingId(null)
      },
    })
  }

  function handleForceDelete() {
    forceDelete.mutate(providerId, {
      onSuccess: () => {
        toast.success(`Provider "${providerName}" borrado`)
        onDeleted()
      },
      onError: (err) => {
        const i = inspectApiError(err, 'borrar el provider')
        toast.error(i.title, { description: i.description })
      },
    })
  }

  function handleDeactivate() {
    deactivate.mutate(providerId, {
      onSuccess: () => {
        toast.success(`Provider "${providerName}" desactivado`)
        onDeleted()
      },
      onError: (err) => {
        const i = inspectApiError(err, 'desactivar el provider')
        toast.error(i.title, { description: i.description })
      },
    })
  }

  const removableEcommerce = b?.ecommerceMerchants.filter((e) => e.removable) ?? []
  const lockedEcommerce = b?.ecommerceMerchants.filter((e) => !e.removable) ?? []

  const historyBlockers = b
    ? [
        { label: 'Webhooks', count: b.webhooks },
        { label: 'Logs de eventos', count: b.eventLogs },
        { label: 'Estructuras de costo', count: b.costStructures },
      ].filter((x) => x.count > 0)
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Borrar provider · {providerName}</DialogTitle>
          <DialogDescription>
            Para borrar un provider de verdad, primero hay que quitar todo lo que lo usa. Lo que es
            historial (pagos, logs) no se puede borrar — esos providers solo se desactivan.
          </DialogDescription>
        </DialogHeader>

        {blockersQ.isLoading ? (
          <p className="text-[13px] text-[var(--ink-faint)]">Revisando dependencias…</p>
        ) : blockersQ.isError ? (
          <QueryError
            error={blockersQ.error}
            context="revisar las dependencias"
            onRetry={() => blockersQ.refetch()}
          />
        ) : b ? (
          <div className="flex flex-col gap-4">
            {b.canDelete ? (
              <div className="flex items-start gap-2 rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas-sunken)] px-4 py-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden />
                <p className="text-[13px] text-[var(--ink-muted)]">
                  Este provider no tiene nada que lo use. Se puede borrar de forma permanente.
                </p>
              </div>
            ) : (
              <>
                {b.merchants.length > 0 && (
                  <BlockerGroup
                    title="Cuentas merchant"
                    hint="Expande cada una para ver y resolver lo que la bloquea."
                  >
                    {b.merchants.map((m) => (
                      <MerchantBlockerRow key={m.id} providerId={providerId} merchant={m} />
                    ))}
                  </BlockerGroup>
                )}

                {removableEcommerce.length > 0 && (
                  <BlockerGroup title="Canales e-commerce" hint="Sin historial — se pueden quitar.">
                    {removableEcommerce.map((e) => (
                      <RemovableRow
                        key={e.id}
                        label={e.label}
                        busy={removingId === e.id}
                        onRemove={() => handleRemoveEcommerce(e.id, e.label)}
                      />
                    ))}
                  </BlockerGroup>
                )}

                {lockedEcommerce.length > 0 && (
                  <BlockerGroup
                    title="Canales e-commerce con historial (no se pueden borrar)"
                    hint="Tienen actividad real; el provider sólo se puede desactivar."
                  >
                    {lockedEcommerce.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-2 last:border-0"
                      >
                        <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-[var(--ink-muted)]">
                          <AlertTriangle
                            className="h-3.5 w-3.5 shrink-0 text-[var(--warn)]"
                            aria-hidden
                          />
                          <span className="truncate">{e.label}</span>
                        </span>
                        {e.reason && (
                          <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--ink-faint)]">
                            {e.reason}
                          </span>
                        )}
                      </div>
                    ))}
                  </BlockerGroup>
                )}

                {historyBlockers.length > 0 && (
                  <BlockerGroup
                    title="Historial (no se puede borrar)"
                    hint="Si existe esto, el provider solo se puede desactivar, no borrar."
                  >
                    {historyBlockers.map((h) => (
                      <div
                        key={h.label}
                        className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-2 last:border-0"
                      >
                        <span className="flex items-center gap-1.5 text-[13px] text-[var(--ink-muted)]">
                          <AlertTriangle className="h-3.5 w-3.5 text-[var(--warn)]" aria-hidden />
                          {h.label}
                        </span>
                        <Badge tone="muted" size="sm">
                          {h.count}
                        </Badge>
                      </div>
                    ))}
                  </BlockerGroup>
                )}
              </>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={deactivate.isPending || forceDelete.isPending}
            onClick={handleDeactivate}
          >
            {deactivate.isPending ? 'Desactivando…' : 'Desactivar'}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={!b?.canDelete || forceDelete.isPending}
            onClick={handleForceDelete}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            {forceDelete.isPending ? 'Borrando…' : 'Borrar definitivamente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BlockerGroup({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="text-[13px] font-semibold text-[var(--ink)]">{title}</h3>
      <p className="mb-1.5 text-[12px] text-[var(--ink-faint)]">{hint}</p>
      <div className="rounded-[8px] border border-[var(--line)] px-3">{children}</div>
    </section>
  )
}

function RemovableRow({
  label,
  busy,
  onRemove,
}: {
  label: string
  busy: boolean
  onRemove: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-2 last:border-0">
      <span className="text-[13px] text-[var(--ink)]">{label}</span>
      <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onRemove}>
        {busy ? 'Quitando…' : 'Quitar'}
      </Button>
    </div>
  )
}
