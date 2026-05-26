import { formatMoney } from '@/shared/lib/money'
import type { EarningsTotals } from './types'

const intFmt = new Intl.NumberFormat('es-MX')

function Kpi({
  label,
  value,
  sub,
  hint,
}: {
  label: string
  value: string
  sub?: React.ReactNode
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`eyebrow text-[var(--ink-faint)]${hint ? ' cursor-help' : ''}`} title={hint}>
        {label}
      </span>
      <span className="text-[22px] font-semibold tabular-nums text-[var(--ink)]">{value}</span>
      {sub ? <span className="text-[12px] tabular-nums text-[var(--ink-muted)]">{sub}</span> : null}
    </div>
  )
}

export function EarningsKpis({ totals }: { totals: EarningsTotals }) {
  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
      <Kpi
        label="Ganancia neta (Avoqado)"
        hint="Lo que realmente se queda Avoqado tras repartir cada margen con el proveedor y el agregador (ambos tramos). No es el spread bruto."
        value={formatMoney(totals.netProfit)}
        sub={
          <>
            Terminales {formatMoney(totals.terminalNet)} · En línea {formatMoney(totals.onlineFees)}
          </>
        }
      />
      <Kpi
        label="Las 2 vías (terminales)"
        hint="Cómo se compone la ganancia de terminales: lo que Avoqado toma del margen proveedor→agregador, más lo del margen agregador→venue."
        value={formatMoney(totals.terminalNet)}
        sub={
          <>
            Prov→agg {formatMoney(totals.tramoProvider)} · Agg→venue{' '}
            {formatMoney(totals.tramoAggregator)}
          </>
        }
      />
      <Kpi
        label="Volumen procesado"
        value={formatMoney(totals.volume)}
        sub={`${intFmt.format(totals.transactions)} transacciones`}
      />
      <Kpi
        label="Tasa efectiva"
        value={`${(totals.averageMargin * 100).toFixed(2)}%`}
        sub="Neto / volumen (terminales)"
      />
    </div>
  )
}
