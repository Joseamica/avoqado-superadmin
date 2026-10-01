import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { inspectApiError } from '@/shared/lib/api-error'
import { formatMoney } from '@/shared/lib/money'
import {
  isStale,
  pausePromotions,
  pricingError,
  retryListPrice,
  saveListPrice,
  type ListPriceRow,
  type RuleViolation,
} from './pricing-api'
import { useInvalidatePricing } from './use-pricing'

const MIN_PRICE = 10
const MAX_PRICE = 100_000
const PESOS = /^\d+(\.\d{1,2})?$/

/** Confirmation to save a function's list price. Its form lives inside the content: it seeds on every opening. */
export function ListPriceDialog({
  row,
  onClose,
}: {
  row: ListPriceRow | null
  onClose: () => void
}) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        {row && <ListPriceForm row={row} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function ListPriceForm({ row, onClose }: { row: ListPriceRow; onClose: () => void }) {
  const invalidate = useInvalidatePricing()
  const [value, setValue] = useState(row.price === null ? '' : String(row.price))
  const [violations, setViolations] = useState<RuleViolation[] | null>(null)
  const [pendingPrice, setPendingPrice] = useState<number | null>(null)
  const price = Number(value)
  const groups = row.activeGroups ?? []
  const valid = PESOS.test(value) && price >= MIN_PRICE && price <= MAX_PRICE

  const finish = () => {
    void invalidate()
    toast.success(`Precio de ${row.name} guardado`, {
      description: 'Quien ya la paga conserva su precio.',
    })
    onClose()
  }
  const fail = (error: unknown) => {
    const { code, details } = pricingError(error)
    if (code === 'HYBRID_LIST_BREAKS_PROMOTIONS' && Array.isArray(details)) {
      setViolations(details as RuleViolation[])
      return
    }
    void invalidate()
    if (code === 'HYBRID_LIST_PREPARING') {
      setViolations(null)
      setPendingPrice((details as ListPriceRow | undefined)?.pendingPrice ?? price)
      return
    }
    if (isStale(code)) {
      toast.error('El precio cambió mientras lo editabas', {
        description: 'Ya cargamos el precio vigente: revísalo y vuelve a guardar.',
      })
      return
    }
    const issue = inspectApiError(error, 'guardar el precio')
    toast.error(issue.title, { description: issue.serverMessage ?? issue.description })
  }

  const save = useMutation({
    mutationFn: () => saveListPrice(row, price),
    onSuccess: finish,
    onError: fail,
  })
  const retry = useMutation({
    mutationFn: () => retryListPrice(row.productKey),
    onSuccess: finish,
    onError: fail,
  })
  const pause = useMutation({
    mutationFn: (broken: RuleViolation[]) => pausePromotions(broken),
    onSuccess: () => {
      setViolations(null)
      save.mutate()
    },
    onError: (error) => {
      // Some may have paused already: saving again asks the server which ones still block (its 409 lists them).
      setViolations(null)
      void invalidate()
      const issue = inspectApiError(error, 'pausar las promociones')
      toast.error(issue.title, {
        description: `${issue.serverMessage ?? issue.description} Volvemos a revisar cuáles siguen activas.`,
      })
      save.mutate()
    },
  })
  const busy = save.isPending || retry.isPending || pause.isPending

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (valid && !busy) save.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>Precio de lista · {row.name}</DialogTitle>
        <DialogDescription>Mensual, en pesos MXN con IVA incluido.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <Field
          name="list-price"
          type="number"
          inputMode="decimal"
          step={0.01}
          min={MIN_PRICE}
          max={MAX_PRICE}
          label="Precio nuevo"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setViolations(null)
            setPendingPrice(null)
          }}
          error={
            value !== '' && !valid
              ? 'Escribe un monto entre $10.00 y $100,000.00, con a lo más 2 decimales.'
              : undefined
          }
          hint="Entre $10.00 y $100,000.00."
          autoFocus
        />
        {valid && (
          <p className="tabular text-[14px] text-[var(--ink)]">
            {`${row.price === null ? 'Sin precio actual' : `Precio actual ${formatMoney(row.price)}`} → Nuevo ${formatMoney(price)}`}
          </p>
        )}
        <p className="text-[13px] text-[var(--ink-muted)]">
          Quien ya la paga conserva su precio. El nuevo aplica a las contrataciones que vengan.
        </p>
        {groups.length > 0 && (
          <p className="text-[13px] text-[var(--ink)]">
            {groups.length === 1
              ? `Un descuento activo la abarca: «${groups[0].name}». Después de guardar, recalcúlalo en Descuentos % para que el % aplique sobre el precio nuevo.`
              : `Descuentos activos la abarcan: ${groups.map((group) => `«${group.name}»`).join(', ')}. Después de guardar, recalcúlalos en Descuentos % para que el % aplique sobre el precio nuevo.`}
          </p>
        )}

        {violations && (
          <section
            aria-label="Promociones que bloquean el precio"
            className="space-y-3 rounded-[8px] bg-[var(--warn-faint)] p-3"
          >
            <p className="text-[13px] text-[var(--ink)]">
              Estas promociones activas costarían lo mismo o más que este precio, o renovarían por
              encima de él:
            </p>
            <ul className="space-y-1 text-[13px]">
              {violations.map((violation) => (
                <li key={violation.campaignId} className="tabular">
                  <span>{`${violation.campaignName} · ${formatMoney(violation.price)}`}</span>
                  {violation.renewalPrice !== null && (
                    <span className="text-[var(--ink-muted)]">
                      {` · renueva a ${formatMoney(violation.renewalPrice)}`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-[12.5px] text-[var(--ink-muted)]">
              Pausarlas detiene contrataciones nuevas; quien ya las contrató conserva su precio.
              Después se guarda el precio.
            </p>
            <Button type="button" disabled={busy} onClick={() => pause.mutate(violations)}>
              {pause.isPending ? 'Pausando…' : 'Pausar estas promociones'}
            </Button>
          </section>
        )}

        {pendingPrice !== null && (
          <section
            aria-label="Precio pendiente"
            className="space-y-3 rounded-[8px] bg-[var(--warn-faint)] p-3"
          >
            <p className="tabular text-[13px] text-[var(--ink)]">
              {`Precio nuevo pendiente: ${formatMoney(pendingPrice)}`}
            </p>
            <p className="text-[12.5px] text-[var(--ink-muted)]">
              Stripe no terminó de prepararlo. El precio anterior se sigue vendiendo mientras tanto.
            </p>
            <Button type="button" disabled={busy} onClick={() => retry.mutate()}>
              {retry.isPending ? 'Reintentando…' : 'Reintentar'}
            </Button>
          </section>
        )}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={!valid || busy}>
          {save.isPending ? 'Guardando…' : 'Guardar precio'}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
      </DialogFooter>
    </form>
  )
}
