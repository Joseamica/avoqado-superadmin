import { PercentInput } from './PercentInput'
import { CARD_TYPES, humanizeCardType, type CardRates } from './types'

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
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {CARD_TYPES.map((card) => {
        const id = `${idPrefix}-${card}`
        return (
          <div key={card}>
            <label htmlFor={id} className="mb-1 block text-[11px] text-[var(--ink-muted)]">
              {humanizeCardType(card)} (%)
            </label>
            <PercentInput
              id={id}
              className="w-full"
              value={value[card]}
              onChange={(rate) => onChange({ ...value, [card]: rate })}
            />
          </div>
        )
      })}
    </div>
  )
}
