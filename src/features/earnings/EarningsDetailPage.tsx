import { useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  DateRangePicker,
  formatDateRangeLabel,
  type DateRangePreset,
  type DateRangeValue,
} from '@/shared/ui/DateRangePicker'
import { FilterPill } from '@/shared/filters/FilterPill'
import { QueryError } from '@/shared/components/QueryError'
import { useEarningsSummary, useEarningsTimeSeries } from './use-earnings'
import { EarningsKpis } from './EarningsKpis'
import { EarningsTrend } from './EarningsTrend'
import { EarningsBreakdown, type TabKey } from './EarningsBreakdown'
import type { Granularity } from './types'

const EARNINGS_DATE_PRESETS: DateRangePreset[] = [
  { label: 'Hoy', hours: 24 },
  { label: 'Últimos 7 días', hours: 168 },
  { label: 'Últimos 30 días', hours: 720 },
  { label: 'Últimos 90 días', hours: 2160 },
]

const VENUE_TABS: readonly TabKey[] = ['merchant', 'card', 'channel']
const MERCHANT_TABS: readonly TabKey[] = ['venue', 'card']

export function EarningsDetailPage() {
  const params = useParams<{ venueId?: string; merchantId?: string }>()
  const scope: 'venue' | 'merchant' = params.venueId ? 'venue' : 'merchant'
  const id = params.venueId ?? params.merchantId ?? ''

  const [dateRange, setDateRange] = useState<DateRangeValue>({})
  const [granularity, setGranularity] = useState<Granularity>('daily')

  const queryParams = {
    startDate: dateRange.startTime,
    endDate: dateRange.endTime,
    ...(scope === 'venue' ? { venueId: id } : { merchantAccountId: id }),
  }
  const summaryQ = useEarningsSummary(queryParams)
  const seriesQ = useEarningsTimeSeries(queryParams, granularity)

  // The name is passed via navigation state from the breakdown row link, so it
  // survives an empty date range (when the aggregated data has no rows to read
  // it from). Falls back to the aggregated data, then a generic label.
  const location = useLocation()
  const passedName = (location.state as { name?: string } | null)?.name
  const name =
    passedName ??
    (scope === 'venue'
      ? summaryQ.data?.byVenue[0]?.venueName
      : summaryQ.data?.byMerchant[0]?.label) ??
    (scope === 'venue' ? 'Negocio' : 'Merchant')

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <Link
        to="/earnings"
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Ganancias
      </Link>
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{scope === 'venue' ? 'Negocio' : 'Merchant'}</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            {name}
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Desglose de la ganancia neta de Avoqado en este{' '}
            {scope === 'venue' ? 'negocio' : 'merchant'}.
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
          context="cargar el desglose"
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
          <EarningsBreakdown
            summary={summaryQ.data}
            tabs={scope === 'venue' ? VENUE_TABS : MERCHANT_TABS}
          />
        </div>
      ) : null}
    </div>
  )
}
