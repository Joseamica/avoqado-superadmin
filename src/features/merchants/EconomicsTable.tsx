import { CARD_TYPES, humanizeCardType } from './types'
import type { CardEconomics, MerchantEconomics } from './economics'

const money = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

/** Tabla "estado de resultados" por tarjeta (sección Economía a fondo).
 *  En modo aggregator con `venueChargeAmount` (vista por-venue) desglosa el
 *  margen en sus dos tramos: proveedor→agregador y agregador→venue. */
export function EconomicsTable({ economics }: { economics: MerchantEconomics }) {
  const isAggregator = economics.mode === 'aggregator'
  // El tramo agregador→venue sólo existe cuando conocemos el pricing del venue.
  const hasAggregatorSplit = economics.byCard.DEBIT.avoqadoMarginAggregator != null
  const hasVenueCharge = economics.byCard.DEBIT.venueChargeAmount != null

  return (
    <div className="overflow-x-auto rounded-[8px] border border-[var(--line-strong)]">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth: 480 }}>
        <thead>
          <tr className="border-b border-[var(--line-strong)] bg-[var(--canvas-sunken)]">
            <th className="eyebrow px-4 py-2.5 text-left" scope="col">
              Concepto
            </th>
            {CARD_TYPES.map((c) => (
              <th key={c} className="eyebrow px-4 py-2.5 text-right" scope="col">
                {humanizeCardType(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row
            label="Costo del proveedor"
            pick={(e) => e.providerCostAmount}
            kind="cost"
            economics={economics}
          />
          {isAggregator && (
            <Row
              label="Precio a agregador"
              pick={(e) => e.aggregatorPriceAmount}
              economics={economics}
            />
          )}
          {(!isAggregator || hasVenueCharge) && (
            <Row label="Paga el venue" pick={(e) => e.venueChargeAmount} economics={economics} />
          )}
          {hasAggregatorSplit && (
            <Row
              label="Cobra el agregador"
              pick={(e) =>
                e.venueChargeAmount != null && e.aggregatorPriceAmount != null
                  ? e.venueChargeAmount - e.aggregatorPriceAmount
                  : null
              }
              economics={economics}
            />
          )}
          {hasAggregatorSplit ? (
            <>
              <Row
                label="Margen Avoqado (proveedor)"
                pick={(e) => e.avoqadoMarginProvider}
                kind="margin"
                economics={economics}
              />
              <Row
                label="Margen Avoqado (agregador)"
                pick={(e) => e.avoqadoMarginAggregator}
                kind="margin"
                economics={economics}
              />
              <Row
                label="Margen Avoqado total"
                pick={(e) => e.avoqadoMargin}
                kind="margin"
                economics={economics}
                strong
              />
            </>
          ) : (
            <Row
              label="Margen Avoqado"
              pick={(e) => e.avoqadoMargin}
              kind="margin"
              economics={economics}
              strong
            />
          )}
        </tbody>
      </table>
    </div>
  )
}

function Row({
  label,
  pick,
  economics,
  kind = 'plain',
  strong,
}: {
  label: string
  pick: (e: CardEconomics) => number | null
  economics: MerchantEconomics
  kind?: 'plain' | 'cost' | 'margin'
  strong?: boolean
}) {
  return (
    <tr className="border-b border-[var(--line)] last:border-0">
      <th
        scope="row"
        className={`px-4 py-2.5 text-left font-normal ${strong ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-muted)]'}`}
      >
        {label}
      </th>
      {CARD_TYPES.map((c) => {
        const raw = pick(economics.byCard[c])
        const display = kind === 'cost' ? money(raw == null ? null : -raw) : money(raw)
        const color =
          kind === 'margin'
            ? raw != null && raw < 0
              ? 'text-[var(--danger)]'
              : 'text-[var(--success)]'
            : 'text-[var(--ink)]'
        return (
          <td
            key={c}
            className={`px-4 py-2.5 text-right tabular-nums ${strong ? 'font-semibold' : ''} ${color}`}
          >
            {display}
          </td>
        )
      })}
    </tr>
  )
}
