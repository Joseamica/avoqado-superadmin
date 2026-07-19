import { CardRatesInput } from './CardRatesInput'
import { PercentInput } from './PercentInput'
import type { CardRates } from './types'
import type { RevenueShareDraft } from './revenue-share'

/**
 * Controles de captura del revenue-share (modo directa/agregador, precio al
 * agregador + IVA, y los % de Avoqado). Controlado vía `value`/`onChange`.
 * Reusado por `EditEconomicsDrawer` (detalle) y `RevenueShareDrawer` (wizard)
 * para tener una sola fuente de verdad del formulario.
 */

const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--ink-muted)]'

interface Props {
  value: RevenueShareDraft
  onChange: (next: RevenueShareDraft) => void
}

export function RevenueShareFields({ value, onChange }: Props) {
  const patch = (p: Partial<RevenueShareDraft>) => onChange({ ...value, ...p })

  return (
    <>
      <div className="mb-3 flex gap-4 text-[13px]">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="rs-mode"
            checked={value.mode === 'direct'}
            onChange={() => patch({ mode: 'direct' })}
          />{' '}
          Directa
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="rs-mode"
            checked={value.mode === 'aggregator'}
            onChange={() => patch({ mode: 'aggregator' })}
          />{' '}
          Vía agregador
        </label>
      </div>

      {value.mode === 'aggregator' && (
        <div className="mb-3">
          <span className={labelCls}>Precio al agregador</span>
          <CardRatesInput
            value={value.aggregatorPrice}
            onChange={(r: CardRates) => patch({ aggregatorPrice: r })}
            idPrefix="agg"
          />
          <label className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
            <input
              type="checkbox"
              checked={value.aggIncludesTax}
              onChange={(e) => patch({ aggIncludesTax: e.target.checked })}
            />
            El precio al agregador ya incluye IVA
          </label>
          <p className="mt-1.5 text-[12px] text-[var(--ink-faint)]">
            Tu precio directo: costo + tu primer margen, hasta donde llega antes del markup del
            agregador. No es lo que el agregador le cobra al venue — eso es el pricing de cada venue
            menos este precio, y se desglosa por venue.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor="shp" className={labelCls}>
            Avoqado del margen proveedor (%)
          </label>
          <PercentInput
            id="shp"
            value={value.shareProvider}
            onChange={(shareProvider) => patch({ shareProvider })}
          />
        </div>
        {value.mode === 'aggregator' && (
          <div>
            <label htmlFor="sha" className={labelCls}>
              Avoqado del margen agregador (%)
            </label>
            <PercentInput
              id="sha"
              value={value.shareAgg}
              onChange={(shareAgg) => patch({ shareAgg })}
            />
            <p className="mt-1.5 max-w-[16rem] text-[12px] text-[var(--ink-faint)]">
              % que se queda Avoqado del markup del agregador (pricing del venue − precio a
              agregador).
            </p>
          </div>
        )}
      </div>
    </>
  )
}
