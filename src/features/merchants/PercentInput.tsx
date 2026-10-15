import { useState } from 'react'
import { cn } from '@/shared/lib/utils'

const pctStr = (d: number) => String(Number((d * 100).toFixed(6)))
const percentage = /^(?:[0-9]+(?:[.,][0-9]*)?|[.,][0-9]+)$/

const baseCls =
  'h-9 w-28 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[13px] tabular-nums ' +
  'placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'

/**
 * Input de un porcentaje suelto (comisión, share, tasa flat). El `value` es
 * decimal (0..1); internamente muestra `×100` y emite `÷100`.
 *
 * Mantiene un buffer de texto para permitir escritura parcial ("3.", "3.5"):
 * sin el buffer, un input controlado re-formatea el value en cada render y borra
 * el punto decimal apenas se teclea (typing "3" → "." reaparece como "3"). Mismo
 * patrón que `CardRatesInput`. Móntalo fresco al abrir el form (el Drawer lo
 * desmonta al cerrar).
 */
export function PercentInput({
  id,
  value,
  onChange,
  className,
}: {
  id?: string
  value: number
  onChange: (dec: number) => void
  className?: string
}) {
  // 0 arranca como placeholder vacío (si no, el input muestra "0" y teclear deja "03.5").
  const [text, setText] = useState(() => (value === 0 ? '' : pctStr(value)))
  return (
    <input
      id={id}
      className={cn(baseCls, className)}
      inputMode="decimal"
      placeholder="0"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const raw = e.target.value.trim()
        const dec = raw === '' ? 0 : Number(raw.replace(',', '.')) / 100
        const valid =
          (raw === '' || percentage.test(raw)) && Number.isFinite(dec) && dec >= 0 && dec <= 1
        e.target.setCustomValidity(
          valid
            ? ''
            : 'Escribe un porcentaje entre 0 y 100, sin letras. Puedes usar punto o coma decimal.',
        )
        if (valid) onChange(dec)
      }}
    />
  )
}
