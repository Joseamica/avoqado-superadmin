import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Combobox } from '@/shared/ui/Combobox'
import { CARD_TYPES, humanizeCardType, type CardType } from './types'
import { REFERENCE_AMOUNT, type CardEconomics, type MerchantEconomics } from './economics'

const money = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
/** El monto por $100 ES el porcentaje efectivo (REFERENCE_AMOUNT = 100). */
const asPct = (amount: number) => `${((amount / REFERENCE_AMOUNT) * 100).toFixed(2)}%`
const sharePct = (frac: number) => `${(frac * 100).toFixed(0)}%`
const moneyTone = (n: number) => (n < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]')

interface Hop {
  /** Entidad por la que pasa el dinero. */
  node: string
  caption?: string
  /** Lo que esta entidad cobra hacia la siguiente. */
  flowLabel?: string
  flowAmount?: number
  /** Reparto del margen de este tramo. */
  splitLabel?: string
  splitBase?: number
  splitShare?: number | null
  splitCut?: number | null
  /** Nodo final pendiente (el cobro al venue es por-venue, no disponible aquí). */
  pending?: boolean
}

function buildHops(
  e: CardEconomics,
  mode: MerchantEconomics['mode'],
  shares?: { provider: number; aggregator: number | null },
): Hop[] {
  const hops: Hop[] = []
  hops.push({
    node: 'Proveedor',
    caption: 'procesa la transacción',
    flowLabel: 'cobra',
    flowAmount: -e.providerCostAmount,
  })

  if (mode === 'aggregator' && e.aggregatorPriceAmount != null) {
    hops.push({
      node: 'Avoqado',
      flowLabel: 'vende al agregador',
      flowAmount: e.aggregatorPriceAmount,
      splitLabel: 'margen proveedor',
      splitBase: e.aggregatorPriceAmount - e.providerCostAmount,
      splitShare: shares?.provider ?? null,
      splitCut: e.avoqadoMarginProvider,
    })
    if (e.venueChargeAmount != null) {
      hops.push({
        node: 'Agregador',
        flowLabel: 'cobra al venue',
        flowAmount: e.venueChargeAmount,
        splitLabel: 'markup agregador',
        splitBase: e.venueChargeAmount - e.aggregatorPriceAmount,
        splitShare: shares?.aggregator ?? null,
        splitCut: e.avoqadoMarginAggregator,
      })
      hops.push({ node: 'Venue', caption: `paga ${money(e.venueChargeAmount)}` })
    } else {
      hops.push({ node: 'Agregador' })
      hops.push({ node: 'Venue', pending: true, caption: 'el cobro al venue es por venue' })
    }
  } else if (e.venueChargeAmount != null) {
    hops.push({
      node: 'Avoqado',
      flowLabel: 'cobra al venue',
      flowAmount: e.venueChargeAmount,
      splitLabel: 'margen',
      splitBase: e.venueChargeAmount - e.providerCostAmount,
      splitShare: shares?.provider ?? null,
      splitCut: e.avoqadoMargin,
    })
    hops.push({ node: 'Venue', caption: `paga ${money(e.venueChargeAmount)}` })
  } else {
    hops.push({ node: 'Avoqado', caption: 'sin pricing — define el pricing del venue' })
  }

  return hops
}

/**
 * Diagrama del flujo del dinero como línea de tiempo vertical:
 * Proveedor → Avoqado → Agregador → Venue. Cada salto muestra la tasa, el monto
 * y cómo se reparte el margen (con la parte de Avoqado). Sobre $100 cobrados.
 *
 * El tramo agregador→venue sólo aparece cuando hay pricing del venue (vista por
 * venue); a nivel merchant queda pendiente y se avisa.
 */
export function MoneyFlowDiagram({
  economics,
  shares,
}: {
  economics: MerchantEconomics
  shares?: { provider: number; aggregator: number | null }
}) {
  const [open, setOpen] = useState(false)
  const [card, setCard] = useState<CardType>('DEBIT')
  const e = economics.byCard[card]
  const hops = buildHops(e, economics.mode, shares)
  const partial = economics.mode === 'aggregator' && e.venueChargeAmount == null
  const total = e.avoqadoMargin ?? 0

  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-[var(--canvas-sunken)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
      >
        <span className="text-[12px] font-medium text-[var(--ink)]">
          Flujo del dinero (por $100)
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {!open ? null : (
        <div className="flex flex-col gap-3 px-3 pb-3">
          <div className="flex items-center justify-end">
            <div className="w-36">
              <Combobox
                value={card}
                onChange={(v) => setCard(v as CardType)}
                options={CARD_TYPES.map((c) => ({ value: c, label: humanizeCardType(c) }))}
                placeholder="Tarjeta"
                ariaLabel="Tipo de tarjeta del flujo"
              />
            </div>
          </div>

          <ol className="flex flex-col">
            {hops.map((h, i) => {
              const last = i === hops.length - 1
              return (
                <li key={`${h.node}-${i}`} className="flex gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full border ${
                        h.pending
                          ? 'border-dashed border-[var(--line-strong)] bg-transparent'
                          : 'border-[var(--line-strong)] bg-[var(--canvas-raised)]'
                      }`}
                      aria-hidden
                    />
                    {!last && <span className="w-px flex-1 bg-[var(--line-strong)]" aria-hidden />}
                  </div>
                  <div className={last ? 'flex-1' : 'flex-1 pb-3.5'}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span
                        className={`text-[13px] font-semibold ${h.pending ? 'text-[var(--ink-faint)]' : 'text-[var(--ink)]'}`}
                      >
                        {h.node}
                      </span>
                      {h.caption && (
                        <span className="text-[12px] text-[var(--ink-faint)]">{h.caption}</span>
                      )}
                    </div>
                    {h.flowLabel && h.flowAmount != null && (
                      <div className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
                        {h.flowLabel}{' '}
                        <span className="tabular-nums text-[var(--ink)]">
                          {money(h.flowAmount)}
                        </span>
                        <span className="text-[var(--ink-faint)]">
                          {' '}
                          · {asPct(Math.abs(h.flowAmount))}
                        </span>
                      </div>
                    )}
                    {h.splitBase != null && (
                      <div className="text-[12px] text-[var(--ink-muted)]">
                        {h.splitLabel} <span className="tabular-nums">{money(h.splitBase)}</span>
                        {h.splitShare != null && <> · Avoqado {sharePct(h.splitShare)}</>}
                        {h.splitCut != null && (
                          <>
                            {' = '}
                            <span className={`font-semibold tabular-nums ${moneyTone(h.splitCut)}`}>
                              {h.splitCut >= 0 ? '+' : ''}
                              {money(h.splitCut)}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="flex items-baseline justify-between border-t border-[var(--line-strong)] pt-2">
            <span className="text-[13px] font-semibold text-[var(--ink)]">
              {partial ? 'Avoqado (proveedor→agregador)' : 'Avoqado se queda'}
            </span>
            <span className={`text-[15px] font-semibold tabular-nums ${moneyTone(total)}`}>
              {money(total)}
            </span>
          </div>
          {partial && (
            <p className="text-[12px] text-[var(--ink-faint)]">
              Falta el tramo agregador→venue (tu % del agregador): depende del pricing de cada venue
              y se calcula por venue.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
