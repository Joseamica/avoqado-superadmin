import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import {
  DEFAULT_TIMEZONE,
  formatDateTime,
  formatRelative,
  timezoneShort,
} from '@/shared/lib/datetime'
import { useActivityLog } from '@/features/activity-log/use-activity-log'
import { actorDisplayName, humanizeAction, severityFor } from '@/features/activity-log/types'
import { useDashboardSummary } from './use-dashboard-summary'
import type { DashboardSummary } from './types'

interface Kpi {
  label: string
  value: string
  delta?: { value: string; direction: 'up' | 'down' | 'neutral'; period: string }
  footnote?: string
}

const MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})

const NUM = new Intl.NumberFormat('es-MX')

function buildKpis(summary: DashboardSummary): Kpi[] {
  const totalKycPending = summary.kyc.pendingReview + summary.kyc.inReview
  return [
    {
      label: 'Venues activos',
      value: `${NUM.format(summary.venues.active)} / ${NUM.format(summary.venues.total)}`,
      footnote:
        summary.venues.suspended > 0
          ? `${summary.venues.suspended} suspendidos`
          : 'sin venues suspendidos',
    },
    {
      label: 'TPVs activos',
      value: `${NUM.format(summary.terminals.active)} / ${NUM.format(summary.terminals.total)}`,
      footnote:
        summary.terminals.pendingActivation > 0
          ? `${summary.terminals.pendingActivation} pendientes de activar`
          : summary.terminals.inactive > 0
            ? `${summary.terminals.inactive} inactivos`
            : 'todos activos',
    },
    {
      label: 'KYC pendientes',
      value: NUM.format(totalKycPending),
      footnote:
        summary.kyc.rejected > 0
          ? `${summary.kyc.rejected} rechazados · ${summary.kyc.verified} verificados`
          : `${summary.kyc.verified} verificados`,
    },
    {
      label: 'Pagos · 24h',
      value:
        summary.payments24h.count > 0 ? MXN.format(summary.payments24h.volumeCents / 100) : '—',
      delta:
        summary.payments24h.failedCount > 0
          ? {
              value: `${summary.payments24h.failedCount} fallidos`,
              direction: 'down',
              period: 'últimas 24 h',
            }
          : undefined,
      footnote: `${NUM.format(summary.payments24h.count)} transacciones`,
    },
  ]
}

export function DashboardPage() {
  const summaryQuery = useDashboardSummary()
  const recentQuery = useActivityLog({ page: 1, pageSize: 5 })

  const summary = summaryQuery.data
  const recent = recentQuery.data?.logs ?? []
  const now = new Date().toISOString()
  const isLoading = summaryQuery.isLoading

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div>
          <p className="eyebrow">Operaciones</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-[1.05] tracking-[-0.028em] text-[var(--ink)] sm:text-[34px] lg:text-[40px]">
            Resumen de la plataforma
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Datos en vivo de la flota Avoqado. Última actualización{' '}
            <span className="tabular text-[var(--ink)]">{formatDateTime(now)}</span>{' '}
            <span className="text-[var(--ink-faint)]">({timezoneShort(DEFAULT_TIMEZONE)})</span>.
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-[6px] border border-[var(--line)] bg-[var(--canvas-sunken)] px-2.5 py-1.5">
          <span
            aria-hidden
            className={
              'h-1.5 w-1.5 rounded-full ' +
              (summaryQuery.isError
                ? 'bg-[var(--danger)] shadow-[0_0_0_3px_var(--danger-faint)]'
                : 'bg-[var(--success)] shadow-[0_0_0_3px_var(--success-faint)]')
            }
          />
          <span className="text-[12px] font-medium text-[var(--ink-muted)]">
            <span className="sr-only">
              Estado del API: {summaryQuery.isError ? 'sin conexión' : 'saludable'}.{' '}
            </span>
            {summaryQuery.isError ? 'API sin conexión' : 'API saludable'}
          </span>
        </div>
      </header>

      {summaryQuery.isError && (
        <div
          role="alert"
          className="mb-7 rounded-[6px] border border-[var(--danger)]/40 bg-[var(--danger-faint)] px-3.5 py-3 text-[13px] text-[var(--danger)]"
        >
          <p className="font-semibold">No pudimos obtener el resumen</p>
          <p className="mt-0.5 text-[var(--ink-muted)]">
            Verifica que <code className="font-mono">VITE_API_URL</code> apunte a un{' '}
            <code className="font-mono">avoqado-server</code> corriendo.
          </p>
        </div>
      )}

      <section
        aria-label="Indicadores"
        className="mb-10 grid grid-cols-1 gap-px overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4"
      >
        {(summary ? buildKpis(summary) : skeletonKpis()).map((kpi, idx) => (
          <article key={kpi.label || idx} className="bg-[var(--canvas)] p-5">
            <p className="eyebrow">{kpi.label}</p>
            <p className="mt-3.5 font-display tabular text-[28px] font-semibold leading-none tracking-[-0.022em] text-[var(--ink)]">
              {isLoading && !summary ? <span className="opacity-40">…</span> : kpi.value}
            </p>
            {kpi.delta && (
              <p className="mt-2 flex items-baseline gap-1.5 text-[12px]">
                <span
                  className={
                    kpi.delta.direction === 'up'
                      ? 'text-[var(--success)]'
                      : kpi.delta.direction === 'down'
                        ? 'text-[var(--danger)]'
                        : 'text-[var(--ink-faint)]'
                  }
                >
                  {kpi.delta.direction === 'up' && '↑'}
                  {kpi.delta.direction === 'down' && '↓'}
                  {kpi.delta.direction === 'neutral' && '·'} {kpi.delta.value}
                </span>
                <span className="text-[var(--ink-faint)]">{kpi.delta.period}</span>
              </p>
            )}
            {kpi.footnote && (
              <p className="mt-3 border-t border-[var(--line)] pt-2.5 text-[11.5px] text-[var(--ink-faint)]">
                {kpi.footnote}
              </p>
            )}
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-10 lg:grid-cols-[1.7fr_1fr]">
        <div>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.018em] text-[var(--ink)]">
              Actividad reciente
            </h2>
            <Link
              to="/activity-log"
              className="group flex items-center gap-1 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--accent)]"
            >
              Ver todo el log
              <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
          <ul className="overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)]">
            {recent.length === 0 && !recentQuery.isLoading && (
              <li className="px-4 py-8 text-center text-[12.5px] text-[var(--ink-faint)]">
                Sin eventos recientes.
              </li>
            )}
            {recentQuery.isLoading && (
              <li className="px-4 py-8 text-center text-[12.5px] text-[var(--ink-faint)]">
                Cargando…
              </li>
            )}
            {recent.map((entry, idx) => {
              const sev = severityFor(entry.action)
              const dotColor =
                sev === 'success'
                  ? 'bg-[var(--success)]'
                  : sev === 'warn'
                    ? 'bg-[var(--warn)]'
                    : sev === 'danger'
                      ? 'bg-[var(--danger)]'
                      : 'bg-[var(--ink-faint)]'
              return (
                <li
                  key={entry.id}
                  className={
                    idx === 0
                      ? 'flex items-start gap-4 p-4'
                      : 'flex items-start gap-4 border-t border-[var(--line)] p-4'
                  }
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] leading-snug text-[var(--ink)]">
                      <span className="font-medium">{actorDisplayName(entry.staff)}</span>
                      {' · '}
                      {humanizeAction(entry.action)}
                    </p>
                    {(entry.venueName || entry.entity) && (
                      <p className="mt-0.5 text-[11.5px] text-[var(--ink-muted)]">
                        {entry.venueName && <span>→ {entry.venueName}</span>}
                        {entry.entity && entry.venueName && (
                          <span className="mx-1.5 opacity-40">·</span>
                        )}
                        {entry.entity && <span className="font-mono">{entry.entity}</span>}
                      </p>
                    )}
                  </div>
                  <p
                    className="tabular shrink-0 text-[11.5px] text-[var(--ink-faint)]"
                    title={formatDateTime(entry.createdAt)}
                  >
                    {formatRelative(entry.createdAt)}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>

        <aside>
          <h2 className="mb-3 font-display text-[18px] font-semibold tracking-[-0.018em] text-[var(--ink)]">
            Necesita atención
          </h2>
          <div className="space-y-2.5">
            {summary && summary.kyc.pendingReview + summary.kyc.inReview > 0 && (
              <AttentionCard
                tone="warn"
                title={`${summary.kyc.pendingReview + summary.kyc.inReview} venues con KYC sin verificar`}
                meta={`${summary.kyc.pendingReview} en review · ${summary.kyc.inReview} en proceso`}
                ctaTo="/kyc"
                ctaLabel="Revisar cola"
              />
            )}
            {summary && summary.payments24h.failedCount > 0 && (
              <AttentionCard
                tone="danger"
                title={`${summary.payments24h.failedCount} pagos fallidos en 24h`}
                meta="Revisa los logs de payment provider"
                ctaTo="/activity-log"
                ctaLabel="Ver eventos"
              />
            )}
            {summary && summary.terminals.pendingActivation > 0 && (
              <AttentionCard
                tone="info"
                title={`${summary.terminals.pendingActivation} TPVs pendientes de activar`}
                meta="Programa la activación en sitio o remota"
                ctaTo="/terminals"
                ctaLabel="Ver flota"
              />
            )}
            {summary &&
              summary.kyc.pendingReview + summary.kyc.inReview === 0 &&
              summary.payments24h.failedCount === 0 &&
              summary.terminals.pendingActivation === 0 && (
                <div className="rounded-[8px] border border-[var(--line)] bg-[var(--canvas)] p-4 text-[13px] text-[var(--ink-muted)]">
                  Todo en orden. Última revisión {formatRelative(now)}.
                </div>
              )}
          </div>
        </aside>
      </section>
    </div>
  )
}

function skeletonKpis(): Kpi[] {
  return [
    { label: 'Venues activos', value: '—', footnote: 'cargando' },
    { label: 'TPVs activos', value: '—', footnote: 'cargando' },
    { label: 'KYC pendientes', value: '—', footnote: 'cargando' },
    { label: 'Pagos · 24h', value: '—', footnote: 'cargando' },
  ]
}

function AttentionCard({
  tone,
  title,
  meta,
  ctaTo,
  ctaLabel,
}: {
  tone: 'warn' | 'danger' | 'info'
  title: string
  meta: string
  ctaTo: string
  ctaLabel: string
}) {
  const accentBar =
    tone === 'warn'
      ? 'bg-[var(--warn)]'
      : tone === 'danger'
        ? 'bg-[var(--danger)]'
        : 'bg-[var(--info)]'

  const badgeTone = tone === 'info' ? 'info' : tone
  const badgeLabel = tone === 'warn' ? 'Atención' : tone === 'danger' ? 'Urgente' : 'Programado'

  return (
    <article className="flex gap-3 rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)] p-3.5">
      <span
        aria-hidden
        className={`mt-1 h-full w-[3px] shrink-0 self-stretch rounded-full ${accentBar}`}
      />
      <div className="min-w-0 flex-1">
        <Badge tone={badgeTone}>{badgeLabel}</Badge>
        <p className="mt-2 text-[13px] font-medium leading-snug text-[var(--ink)]">{title}</p>
        <p className="mt-1 text-[11.5px] text-[var(--ink-muted)]">{meta}</p>
        <Link
          to={ctaTo}
          className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
        >
          {ctaLabel}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </article>
  )
}
