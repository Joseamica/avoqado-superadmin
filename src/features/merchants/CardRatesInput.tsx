import { useState } from 'react'
import { CARD_TYPES, humanizeCardType, type CardRates, type CardType } from './types'

const toPct = (dec: number): string => {
  if (!Number.isFinite(dec)) return ''
  return String(Math.round(dec * 10000) / 100) // 0.015 -> "1.5"
}

const inputCls =
  'h-9 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[13px] tabular-nums ' +
  'placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'

/**
 * Cuatro inputs de tasa por tipo de tarjeta, en PORCENTAJE. El value es
 * `CardRates` en decimal (0..1); internamente muestra `×100` y emite `÷100`.
 * Mantiene un buffer de texto para permitir escritura parcial ("1.", "").
 * Móntalo fresco al abrir el form (el Drawer lo desmonta al cerrar).
 */
export function CardRatesInput({
  value,
  onChange,
  idPrefix,
}: {
  value: CardRates
  onChange: (next: CardRates) => void
  idPrefix: string
}) {
  const [text, setText] = useState<Record<CardType, string>>(() => ({
    DEBIT: toPct(value.DEBIT),
    CREDIT: toPct(value.CREDIT),
    AMEX: toPct(value.AMEX),
    INTERNATIONAL: toPct(value.INTERNATIONAL),
  }))

  function handle(card: CardType, raw: string) {
    setText((t) => ({ ...t, [card]: raw }))
    const parsed = raw.trim() === '' ? 0 : parseFloat(raw) / 100
    onChange({ ...value, [card]: Number.isFinite(parsed) ? parsed : 0 })
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {CARD_TYPES.map((card) => {
        const id = `${idPrefix}-${card}`
        return (
          <div key={card}>
            <label htmlFor={id} className="mb-1 block text-[11px] text-[var(--ink-muted)]">
              {humanizeCardType(card)} (%)
            </label>
            <input
              id={id}
              className={inputCls}
              inputMode="decimal"
              value={text[card]}
              onChange={(e) => handle(card, e.target.value)}
            />
          </div>
        )
      })}
    </div>
  )
}
