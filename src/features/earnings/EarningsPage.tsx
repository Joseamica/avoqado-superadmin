import { useState } from 'react'
import {
  DateRangePicker,
  formatDateRangeLabel,
  type DateRangePreset,
  type DateRangeValue,
} from '@/shared/ui/DateRangePicker'
import { FilterPill } from '@/shared/filters/FilterPill'
import { QueryError } from '@/shared/components/QueryError'
import { EARNINGS_ALL_TIME_START } from './api'
import { useEarningsSummary, useEarningsTimeSeries } from './use-earnings'
import { EarningsKpis } from './EarningsKpis'
import { EarningsTrend } from './EarningsTrend'
import { EarningsBreakdown } from './EarningsBreakdown'
import type { Granularity } from './types'

const EARNINGS_DATE_PRESETS: DateRangePreset[] = [
  { label: 'Hoy', hours: 24 },
  { label: 'Últimos 7 días', hours: 168 },
  { label: 'Últimos 30 días', hours: 720 },
  { label: 'Últimos 90 días', hours: 2160 },
]

export function EarningsPage() {
  const [dateRange, setDateRange] = useState<DateRangeValue>({})
  const [granularity, setGranularity] = useState<Granularity>('daily')

  // Sin filtro = todo el histórico (el backend, sin startDate, asume mes actual).
  const range = {
    startDate: dateRange.startTime ?? EARNINGS_ALL_TIME_START,
    endDate: dateRange.endTime,
  }
  const summaryQ = useEarningsSummary(range)
  const seriesQ = useEarningsTimeSeries(range, granularity)

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Operación</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            Ganancias
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Cuánto gana Avoqado: terminales + cobros en línea, por negocio, merchant, proveedor y
            tarjeta.
          </p>
        </div>

        <FilterPill
          label="Periodo"
          activeLabel={formatDateRangeLabel(dateRange)}
          activeCount={dateRange.startTime ? 1 : 0}
          onClear={() => setDateRange({})}
          popoverClassName="w-auto"
        >
          <DateRangePicker
            value={dateRange}
            onApply={setDateRange}
            presets={EARNINGS_DATE_PRESETS}
          />
        </FilterPill>
      </header>

      {summaryQ.isError ? (
        <QueryError
          className="mb-5"
          error={summaryQ.error}
          context="cargar las ganancias"
          onRetry={() => summaryQ.refetch()}
          isRetrying={summaryQ.isFetching}
        />
      ) : summaryQ.isLoading ? (
        <p className="text-[13px] text-[var(--ink-faint)]">Calculando…</p>
      ) : summaryQ.data ? (
        <div className="flex flex-col gap-6">
          <EarningsKpis totals={summaryQ.data.totals} />
          <EarningsTrend
            data={seriesQ.data ?? []}
            granularity={granularity}
            onGranularityChange={setGranularity}
          />
          <EarningsBreakdown summary={summaryQ.data} />
        </div>
      ) : null}
    </div>
  )
}
