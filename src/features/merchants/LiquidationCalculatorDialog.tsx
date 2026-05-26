import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { Combobox } from '@/shared/ui/Combobox'
import { CARD_TYPES, humanizeCardType, type CardType } from './types'
import { REFERENCE_AMOUNT, type MerchantEconomics } from './economics'

const money = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueName: string
  /** Economía del venue (por $100). Se escala al monto capturado. */
  economics: MerchantEconomics
}

/**
 * Calculadora de liquidación/dispersión por venue. El operador captura el monto
 * transaccionado y, según lo configurado (costo, precio a agregador, pricing del
 * venue y los repartos), calcula cuánto le toca a cada parte — escalando la
 * economía por-$100 ya computada al monto real.
 */
export function LiquidationCalculatorDialog({ open, onOpenChange, venueName, economics }: Props) {
  const [amountText, setAmountText] = useState('1000')
  const [card, setCard] = useState<CardType>('DEBIT')

  const amount = (() => {
    const n = parseFloat(amountText)
    return Number.isFinite(n) && n > 0 ? n : 0
  })()
  const factor = amount / REFERENCE_AMOUNT
  const e = economics.byCard[card]
  const isAggregator = economics.mode === 'aggregator' && e.aggregatorPriceAmount != null
  const v = (n: number | null) => (n == null ? null : n * factor)

  const rows: {
    label: string
    amount: number | null
    tone?: 'cost' | 'margin'
    strong?: boolean
  }[] = []
  rows.push({ label: 'Costo del proveedor', amount: v(e.providerCostAmount), tone: 'cost' })
  if (isAggregator) rows.push({ label: 'Precio a agregador', amount: v(e.aggregatorPriceAmount) })
  if (e.venueChargeAmount != null)
    rows.push({ label: 'Paga el venue', amount: v(e.venueChargeAmount) })
  if (isAggregator && e.venueChargeAmount != null && e.aggregatorPriceAmount != null)
    rows.push({
      label: 'Cobra el agregador',
      amount: v(e.venueChargeAmount - e.aggregatorPriceAmount),
    })
  if (e.avoqadoMarginAggregator != null) {
    rows.push({
      label: 'Margen Avoqado (proveedor)',
      amount: v(e.avoqadoMarginProvider),
      tone: 'margin',
    })
    rows.push({
      label: 'Margen Avoqado (agregador)',
      amount: v(e.avoqadoMarginAggregator),
      tone: 'margin',
    })
    rows.push({
      label: 'Margen Avoqado total',
      amount: v(e.avoqadoMargin),
      tone: 'margin',
      strong: true,
    })
  } else {
    rows.push({ label: 'Margen Avoqado', amount: v(e.avoqadoMargin), tone: 'margin', strong: true })
  }
  if (e.venueChargeAmount != null)
    rows.push({
      label: 'Recibe el venue (neto)',
      amount: amount - (v(e.venueChargeAmount) ?? 0),
      strong: true,
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calculadora de liquidación · {venueName}</DialogTitle>
          <DialogDescription>
            Captura el monto transaccionado y calculamos el reparto según lo configurado para este
            venue.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <label
                htmlFor="calc-amount"
                className="mb-1 block text-[12px] font-medium text-[var(--ink-muted)]"
              >
                Monto transaccionado
              </label>
              <div className="flex items-center gap-1.5 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--ring)]">
                <span className="text-[13px] text-[var(--ink-faint)]">$</span>
                <input
                  id="calc-amount"
                  className="h-9 w-full bg-transparent text-[14px] tabular-nums focus:outline-none"
                  inputMode="decimal"
                  value={amountText}
                  onChange={(ev) => setAmountText(ev.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="w-40">
              <span className="mb-1 block text-[12px] font-medium text-[var(--ink-muted)]">
                Tarjeta
              </span>
              <Combobox
                value={card}
                onChange={(val) => setCard(val as CardType)}
                options={CARD_TYPES.map((c) => ({ value: c, label: humanizeCardType(c) }))}
                placeholder="Tarjeta"
                ariaLabel="Tipo de tarjeta"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-[var(--line-strong)]">
            <div className="flex items-baseline justify-between border-b border-[var(--line-strong)] bg-[var(--canvas-sunken)] px-4 py-2.5">
              <span className="text-[12px] text-[var(--ink-muted)]">Monto transaccionado</span>
              <span className="text-[14px] font-semibold tabular-nums text-[var(--ink)]">
                {money(amount)}
              </span>
            </div>
            <dl className="flex flex-col">
              {rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] px-4 py-2 last:border-0"
                >
                  <dt
                    className={`text-[13px] ${r.strong ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-muted)]'}`}
                  >
                    {r.label}
                  </dt>
                  <dd
                    className={`text-[13px] tabular-nums ${r.strong ? 'font-semibold ' : ''}${
                      r.tone === 'margin'
                        ? r.amount != null && r.amount < 0
                          ? 'text-[var(--danger)]'
                          : 'text-[var(--success)]'
                        : 'text-[var(--ink)]'
                    }`}
                  >
                    {r.amount == null
                      ? '—'
                      : r.tone === 'cost'
                        ? `−${money(r.amount)}`
                        : r.tone === 'margin' && r.amount >= 0
                          ? `+${money(r.amount)}`
                          : money(r.amount)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
