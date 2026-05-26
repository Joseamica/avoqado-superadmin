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
        label="Ganancia bruta"
        hint="Lo que se le cobra al negocio menos lo que paga el proveedor. Si hay un agregador de por medio, su comisión aún no se descuenta aquí."
        value={formatMoney(totals.grossProfit)}
        sub={
          <>
            Terminales {formatMoney(totals.terminalProfit)} · En línea{' '}
            {formatMoney(totals.onlineFees)}
          </>
        }
      />
      <Kpi label="Volumen procesado" value={formatMoney(totals.volume)} />
      <Kpi
        label="Margen promedio"
        value={`${(totals.averageMargin * 100).toFixed(2)}%`}
        sub="Sólo terminales"
      />
      <Kpi label="Transacciones" value={intFmt.format(totals.transactions)} />
    </div>
  )
}
