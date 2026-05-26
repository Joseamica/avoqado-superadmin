import { useState } from 'react'
import { Combobox } from '@/shared/ui/Combobox'
import { CARD_TYPES, humanizeCardType, type CardType, type ProviderCostStructure } from './types'
import { REFERENCE_AMOUNT, type MerchantEconomics } from './economics'

const money = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

const ratePct = (fraction: number) => `${(fraction * 100).toFixed(2)}%`
const pct = (n: number) => `${(n * 100).toFixed(0)}%`

/**
 * Flujo de dinero escalonado para un tipo de tarjeta. Lee el `MerchantEconomics`
 * ya computado y narra la cadena según el modo. Degrada con elegancia.
 */
export function MoneyFlow({
  economics,
  cost,
}: {
  economics: MerchantEconomics
  cost?: ProviderCostStructure | null
}) {
  const [card, setCard] = useState<CardType>('DEBIT')
  const e = economics.byCard[card]

  const rows: {
    label: string
    amount: string
    strong?: boolean
    muted?: boolean
    indent?: boolean
  }[] = []
  rows.push({ label: `Sobre ${money(REFERENCE_AMOUNT)} cobrados`, amount: '', muted: true })

  const taxRate = cost?.taxRate ?? 0
  if (taxRate > 0) {
    const base = e.providerCostAmount / (1 + taxRate)
    const baseRate = base / REFERENCE_AMOUNT
    const taxAmount = e.providerCostAmount - base
    rows.push({
      label: `Comisión proveedor (${ratePct(baseRate)})`,
      amount: `−${money(base)}`,
      muted: true,
    })
    rows.push({
      label: `+ IVA s/comisión (${pct(taxRate)})`,
      amount: `−${money(taxAmount)}`,
      muted: true,
      indent: true,
    })
    rows.push({ label: 'Total costo proveedor', amount: `−${money(e.providerCostAmount)}` })
  } else {
    rows.push({
      label: 'Costo del proveedor',
      amount: `−${money(e.providerCostAmount)}`,
      muted: true,
    })
  }

  if (economics.mode === 'no-pricing') {
    rows.push({
      label: 'Sin pricing configurado — no podemos calcular margen',
      amount: '',
      muted: true,
    })
  } else if (economics.mode === 'aggregator' && e.aggregatorPriceAmount != null) {
    rows.push({
      label: 'Precio a agregador (Avoqado cobra)',
      amount: money(e.aggregatorPriceAmount),
    })
    if (e.avoqadoMargin != null)
      rows.push({
        label: 'Margen Avoqado (lado proveedor)',
        amount: money(e.avoqadoMargin),
        strong: true,
      })
  } else if (e.venueChargeAmount != null) {
    rows.push({ label: 'Lo que paga el venue', amount: money(e.venueChargeAmount) })
    if (e.avoqadoMargin != null)
      rows.push({ label: 'Margen Avoqado', amount: money(e.avoqadoMargin), strong: true })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-[var(--ink)]">Flujo de dinero</h3>
        <div className="w-40">
          <Combobox
            value={card}
            onChange={(v) => setCard(v as CardType)}
            options={CARD_TYPES.map((c) => ({ value: c, label: humanizeCardType(c) }))}
            placeholder="Tipo de tarjeta"
            ariaLabel="Tipo de tarjeta"
          />
        </div>
      </div>
      <dl className="flex flex-col">
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-1.5 last:border-0"
          >
            <dt
              className={`text-[13px] ${r.muted ? 'text-[var(--ink-faint)]' : 'text-[var(--ink-muted)]'}${r.indent ? ' pl-3' : ''}`}
            >
              {r.label}
            </dt>
            <dd
              className={
                r.strong
                  ? 'text-[14px] font-semibold tabular-nums text-[var(--success)]'
                  : 'text-[13px] tabular-nums text-[var(--ink)]'
              }
            >
              {r.amount}
            </dd>
          </div>
        ))}
      </dl>
      {economics.mode === 'aggregator' && (
        <p className="text-[11.5px] text-[var(--ink-faint)]">
          El tramo agregador→venue (comisión por venue) se muestra por venue en la sección Venues.
        </p>
      )}
    </div>
  )
}
