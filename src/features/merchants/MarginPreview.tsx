import { CARD_TYPES, humanizeCardType } from './types'
import type { MerchantEconomics } from './economics'

const money = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

/** Preview compacto del margen Avoqado por tarjeta. Lee el MerchantEconomics ya computado. */
export function MarginPreview({ economics }: { economics: MerchantEconomics }) {
  // A nivel merchant con agregador sólo se puede calcular el tramo 1 (el tramo
  // agregador→venue necesita el pricing de cada venue). Lo avisamos para que el
  // % del agregador no parezca ignorado.
  const aggregatorMerchantLevel =
    economics.mode === 'aggregator' && economics.byCard.DEBIT.avoqadoMarginAggregator == null

  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-[var(--canvas-sunken)] p-3">
      <p className="mb-2 text-[12px] font-medium text-[var(--ink)]">
        {aggregatorMerchantLevel
          ? 'Margen Avoqado · proveedor→agregador (por $100)'
          : 'Margen Avoqado (por $100)'}
      </p>
      {economics.mode === 'no-pricing' ? (
        <p className="text-[12px] text-[var(--ink-faint)]">
          Sin pricing — define el pricing por venue para ver el margen directo.
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          {CARD_TYPES.map((c) => (
            <div key={c} className="flex items-baseline justify-between">
              <dt className="text-[12px] text-[var(--ink-muted)]">{humanizeCardType(c)}</dt>
              <dd className="text-[13px] font-semibold tabular-nums text-[var(--success)]">
                {money(economics.byCard[c].avoqadoMargin)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {aggregatorMerchantLevel && (
        <p className="mt-2 text-[12px] text-[var(--ink-faint)]">
          Falta el tramo agregador→venue (tu % del agregador): depende del pricing de cada venue y
          se calcula por venue, en la sección Venues.
        </p>
      )}
    </div>
  )
}
