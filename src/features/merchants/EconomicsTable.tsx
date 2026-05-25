import { CARD_TYPES, humanizeCardType } from './types'
import type { MerchantEconomics } from './economics'

const money = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

/** Tabla "estado de resultados" por tarjeta (sección Economía a fondo). */
export function EconomicsTable({ economics }: { economics: MerchantEconomics }) {
  const isAggregator = economics.mode === 'aggregator'
  return (
    <div className="overflow-x-auto rounded-[8px] border border-[var(--line-strong)]">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth: 480 }}>
        <thead>
          <tr className="border-b border-[var(--line-strong)] bg-[var(--canvas-sunken)]">
            <th className="eyebrow px-4 py-2.5 text-left">Concepto</th>
            {CARD_TYPES.map((c) => (
              <th key={c} className="eyebrow px-4 py-2.5 text-right">
                {humanizeCardType(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row
            label="Costo del proveedor"
            pick={(e) => money(-e.providerCostAmount)}
            economics={economics}
          />
          {isAggregator ? (
            <Row
              label="Precio a agregador"
              pick={(e) => money(e.aggregatorPriceAmount)}
              economics={economics}
            />
          ) : (
            <Row
              label="Paga el venue"
              pick={(e) => money(e.venueChargeAmount)}
              economics={economics}
            />
          )}
          <Row
            label="Margen Avoqado"
            pick={(e) => money(e.avoqadoMargin)}
            economics={economics}
            strong
          />
        </tbody>
      </table>
    </div>
  )
}

function Row({
  label,
  pick,
  economics,
  strong,
}: {
  label: string
  pick: (e: MerchantEconomics['byCard']['DEBIT']) => string
  economics: MerchantEconomics
  strong?: boolean
}) {
  return (
    <tr className="border-b border-[var(--line)] last:border-0">
      <td
        className={`px-4 py-2.5 ${strong ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-muted)]'}`}
      >
        {label}
      </td>
      {CARD_TYPES.map((c) => (
        <td
          key={c}
          className={`px-4 py-2.5 text-right tabular-nums ${strong ? 'font-semibold text-[var(--success)]' : 'text-[var(--ink)]'}`}
        >
          {pick(economics.byCard[c])}
        </td>
      ))}
    </tr>
  )
}
