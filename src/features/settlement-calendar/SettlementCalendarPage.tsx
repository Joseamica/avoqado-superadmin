import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { QueryError } from '@/shared/components/QueryError'
import { formatMoney } from '@/shared/lib/money'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { DayDetail } from './DayDetail'
import { DayList } from './DayList'
import { MonthGrid } from './MonthGrid'
import { currentMonth, formatMonthLabel, shiftMonth, todayKey } from './month-grid'
import { useSettlementCalendar } from './use-settlement-calendar'

export function SettlementCalendarPage() {
  const [month, setMonth] = useState(currentMonth)
  // `null` = nada elegido todavía; resolvemos a "hoy si tiene dinero, si no el
  // primer día con dinero" al render, sin useEffect (regla: no derived state en efectos).
  const [picked, setPicked] = useState<string | null>(null)

  const query = useSettlementCalendar(month)
  const data = query.data

  const daysWithMoney = data?.days.filter((d) => d.net > 0) ?? []
  const today = todayKey()
  const defaultDate =
    daysWithMoney.find((d) => d.date === today)?.date ??
    daysWithMoney.find((d) => d.date >= today)?.date ??
    daysWithMoney[daysWithMoney.length - 1]?.date ??
    null
  // Si cambias de mes, el día elegido del mes anterior ya no existe → cae al default.
  const selected = picked && daysWithMoney.some((d) => d.date === picked) ? picked : defaultDate
  const selectedDay = daysWithMoney.find((d) => d.date === selected) ?? null

  const goMonth = (delta: number) => {
    setMonth((m) => shiftMonth(m, delta))
    setPicked(null)
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Operación</p>
          <h1 className="display mt-1.5 text-[28px] leading-none text-[var(--ink)] sm:text-[34px]">
            Depósitos
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Cuánto cae cada día y a qué negocio, en todos los venues a la vez. Por fecha de
            liquidación — no por fecha de venta.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <IconButton size="md" aria-label="Mes anterior" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </IconButton>
          <span className="min-w-[130px] text-center text-[14px] font-medium text-[var(--ink)]">
            {formatMonthLabel(month)}
          </span>
          <IconButton size="md" aria-label="Mes siguiente" onClick={() => goMonth(1)}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </IconButton>
          {month !== currentMonth() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMonth(currentMonth())
                setPicked(null)
              }}
            >
              Hoy
            </Button>
          )}
        </div>
      </header>

      {query.isError && (
        <QueryError
          className="mb-5"
          error={query.error}
          context="cargar el calendario de depósitos"
          onRetry={() => query.refetch()}
        />
      )}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-6 md:grid-cols-4">
            <Kpi
              label="Total del mes"
              value={formatMoney(data.total.net)}
              sub={`Bruto ${formatMoney(data.total.gross)}`}
            />
            <Kpi label="Negocios" value={String(data.venueCount)} />
            <Kpi label="Días con depósito" value={String(daysWithMoney.length)} />
            <Kpi label="Cobros" value={String(data.total.count)} />
          </div>

          {/* Dinero que el motor no pudo fechar. Se muestra SIEMPRE que exista: si lo
              escondiéramos, el total del calendario estaría corto y nadie sabría por qué. */}
          {data.unprojected.count > 0 && (
            <p className="mb-5 rounded-[6px] border border-[var(--line)] bg-[var(--canvas-raised)] px-3 py-2 text-[12.5px] text-[var(--ink-muted)]">
              <span className="tabular font-semibold text-[var(--ink)]">
                {formatMoney(data.unprojected.gross)}
              </span>{' '}
              en {data.unprojected.count} {data.unprojected.count === 1 ? 'cobro' : 'cobros'} no
              aparece en ningún día: le falta el costo de transacción o la regla de liquidación de
              su merchant. No está sumado arriba.
            </p>
          )}

          {daysWithMoney.length === 0 ? (
            <div className="rounded-[6px] border border-[var(--line)] px-4 py-10 text-center">
              <p className="text-[14px] font-medium text-[var(--ink)]">
                No hay depósitos en {formatMonthLabel(month)}
              </p>
              <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
                Esta pantalla muestra el dinero con tarjeta agrupado por el día en que liquida. El
                efectivo no aparece: no liquida, ya está en la caja del negocio.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Móvil: lista de días (el grid trunca los montos a "$…" a 390px).
                  sm+: el calendario, que es donde la forma del mes aporta. */}
              <div className="sm:hidden">
                <DayList days={daysWithMoney} selected={selected} onSelect={setPicked} />
              </div>
              <div className="hidden sm:block">
                <MonthGrid
                  month={month}
                  days={data.days}
                  selected={selected}
                  onSelect={setPicked}
                />
              </div>
              {selectedDay && <DayDetail day={selectedDay} />}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Mismo tratamiento que los KPIs de Ganancias (`EarningsKpis`): sin borde,
// eyebrow + cifra de 22px. Son páginas hermanas de dinero — si una enmarca sus
// KPIs en tarjetas y la otra no, la consola se siente de dos autores distintos.
function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      <span className="tabular text-[22px] font-semibold text-[var(--ink)]">{value}</span>
      {sub ? <span className="tabular text-[12px] text-[var(--ink-muted)]">{sub}</span> : null}
    </div>
  )
}
