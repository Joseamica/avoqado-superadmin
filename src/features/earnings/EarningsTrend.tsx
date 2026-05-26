import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/shared/ui/Button'
import { formatMoney, formatCompactMoney } from '@/shared/lib/money'
import type { EarningsTimePoint, Granularity } from './types'

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'daily', label: 'Día' },
  { value: 'weekly', label: 'Semana' },
  { value: 'monthly', label: 'Mes' },
]

export function EarningsTrend({
  data,
  granularity,
  onGranularityChange,
}: {
  data: EarningsTimePoint[]
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
}) {
  return (
    <section className="rounded-[10px] border border-[var(--line)] p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-[var(--ink)]">Tendencia</h2>
        <div className="flex gap-1">
          {OPTIONS.map((o) => (
            <Button
              key={o.value}
              size="sm"
              variant={o.value === granularity ? 'secondary' : 'ghost'}
              onClick={() => onGranularityChange(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </header>
      {data.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[var(--ink-faint)]">
          No hubo transacciones en este rango. Prueba ampliar las fechas.
        </p>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--ink-faint)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatCompactMoney(Number(v))}
                tick={{ fontSize: 11, fill: 'var(--ink-faint)' }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                formatter={(v: number) => formatMoney(v)}
                contentStyle={{
                  background: 'var(--canvas-raised)',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="var(--ink)"
                fill="var(--canvas-raised)"
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
