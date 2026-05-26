import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, AlertTriangle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  useMerchantBlockers,
  useDetachTerminal,
  useRemoveCostStructure,
  useRemoveMerchantAccount,
} from './use-payment-providers'

/**
 * Fila de un merchant dentro del borrado guiado del provider. "Quitar" intenta
 * borrarlo; si está bloqueado, se expande mostrando SUS propios bloqueadores
 * (terminales y costos removibles inline; slots con link; historial no-removible).
 */
export function MerchantBlockerRow({
  providerId,
  merchant,
}: {
  providerId: string
  merchant: { id: string; label: string }
}) {
  const [open, setOpen] = useState(false)
  const blockersQ = useMerchantBlockers(merchant.id, open)
  const removeMerchant = useRemoveMerchantAccount(providerId)
  const detach = useDetachTerminal(providerId, merchant.id)
  const removeCost = useRemoveCostStructure(providerId, merchant.id)
  const [busyId, setBusyId] = useState<string | null>(null)

  const b = blockersQ.data

  function tryRemove() {
    removeMerchant.mutate(merchant.id, {
      onSuccess: () => toast.success(`Merchant "${merchant.label}" quitado`),
      onError: (err) => {
        const i = inspectApiError(err, 'quitar el merchant')
        toast.error(i.title, { description: i.description })
        setOpen(true) // auto-expandir para mostrar qué lo bloquea
      },
    })
  }

  function detachTerminal(id: string) {
    setBusyId(id)
    detach.mutate(id, {
      onSuccess: () => {
        toast.success('Terminal desasignada')
        setBusyId(null)
      },
      onError: (err) => {
        const i = inspectApiError(err, 'desasignar la terminal')
        toast.error(i.title, { description: i.description })
        setBusyId(null)
      },
    })
  }

  function removeCostStructure(id: string) {
    setBusyId(id)
    removeCost.mutate(id, {
      onSuccess: () => {
        toast.success('Estructura de costo quitada')
        setBusyId(null)
      },
      onError: (err) => {
        const i = inspectApiError(err, 'quitar la estructura de costo')
        toast.error(i.title, { description: i.description })
        setBusyId(null)
      },
    })
  }

  return (
    <div className="border-b border-[var(--line)] py-2 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
          <span className="truncate text-[13px] text-[var(--ink)]">{merchant.label}</span>
        </button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={removeMerchant.isPending}
          onClick={tryRemove}
        >
          {removeMerchant.isPending ? 'Quitando…' : 'Quitar'}
        </Button>
      </div>

      {open && (
        <div className="mt-2 pl-5">
          {blockersQ.isLoading ? (
            <p className="text-[12px] text-[var(--ink-faint)]">Revisando dependencias…</p>
          ) : !b ? null : b.canDelete ? (
            <p className="text-[12px] text-[var(--ink-faint)]">
              Sin dependencias. Ya se puede quitar con el botón de arriba.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {b.terminals.length > 0 && (
                <Mini title="Terminales que lo procesan">
                  {b.terminals.map((t) => (
                    <MiniRow
                      key={t.id}
                      label={t.serialNumber || t.name || t.id}
                      action={
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === t.id}
                          onClick={() => detachTerminal(t.id)}
                        >
                          {busyId === t.id ? '…' : 'Desasignar'}
                        </Button>
                      }
                    />
                  ))}
                </Mini>
              )}

              {b.costStructures.length > 0 && (
                <Mini title="Estructuras de costo">
                  {b.costStructures.map((cs) => (
                    <MiniRow
                      key={cs.id}
                      label={`Costo ${cs.id.slice(-6)}`}
                      action={
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === cs.id}
                          onClick={() => removeCostStructure(cs.id)}
                        >
                          {busyId === cs.id ? '…' : 'Quitar'}
                        </Button>
                      }
                    />
                  ))}
                </Mini>
              )}

              {b.venueConfigs.length > 0 && (
                <Mini title="Asignado a slots de venue">
                  {b.venueConfigs.map((vc) => (
                    <MiniRow
                      key={`${vc.venueId}-${vc.slot}`}
                      label={`${vc.venueName} · ${vc.slot}`}
                      action={
                        <Link
                          to={`/venues/${vc.venueId}/merchant`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
                        >
                          Slots <ExternalLink className="h-3 w-3" aria-hidden />
                        </Link>
                      }
                    />
                  ))}
                </Mini>
              )}

              {(b.payments > 0 || b.transactionCosts > 0) && (
                <Mini title="Historial (no se puede borrar)">
                  {b.payments > 0 && <HistoryRow label="Pagos procesados" count={b.payments} />}
                  {b.transactionCosts > 0 && (
                    <HistoryRow label="Costos de transacción" count={b.transactionCosts} />
                  )}
                  <p className="pt-1 text-[11.5px] text-[var(--ink-faint)]">
                    Con historial, este merchant no se puede borrar — sólo desactivar.
                  </p>
                </Mini>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Mini({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11.5px] font-medium text-[var(--ink-muted)]">{title}</p>
      <div className="rounded-[6px] border border-[var(--line)] px-2.5">{children}</div>
    </div>
  )
}

function MiniRow({ label, action }: { label: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-1.5 last:border-0">
      <span className="truncate text-[12px] tabular-nums text-[var(--ink)]">{label}</span>
      {action}
    </div>
  )
}

function HistoryRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-1.5 last:border-0">
      <span className="flex items-center gap-1.5 text-[12px] text-[var(--ink-muted)]">
        <AlertTriangle className="h-3 w-3 text-[var(--warn)]" aria-hidden />
        {label}
      </span>
      <Badge tone="muted" size="sm">
        {count}
      </Badge>
    </div>
  )
}
