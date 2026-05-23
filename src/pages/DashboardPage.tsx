import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import {
  DEFAULT_TIMEZONE,
  formatDateTime,
  formatRelative,
  timezoneShort,
} from '@/lib/datetime'
import { MOCK_ACTIVITY } from './ActivityLogPage.mock'

interface Kpi {
  label: string
  value: string
  delta?: { value: string; direction: 'up' | 'down' | 'neutral'; period: string }
  footnote?: string
}

const KPIS: Kpi[] = [
  {
    label: 'Venues activos',
    value: '1,247',
    delta: { value: '+18', direction: 'up', period: '7 d' },
    footnote: '34 onboarding en curso',
  },
  {
    label: 'TPVs en línea',
    value: '4,083 / 4,201',
    delta: { value: '−12', direction: 'down', period: 'última hora' },
    footnote: 'objetivo 97.5 %',
  },
  {
    label: 'KYC pendientes',
    value: '23',
    delta: { value: '0', direction: 'neutral', period: 'estable' },
    footnote: 'más antigua: hace 6 h',
  },
  {
    label: 'Volumen 24 h',
    value: '$ 18.4M MXN',
    delta: { value: '+7.4 %', direction: 'up', period: 'vs. mismo día sem. pasada' },
    footnote: '52,194 transacciones',
  },
]

export function DashboardPage() {
  const now = new Date().toISOString()
  const recent = MOCK_ACTIVITY.slice(0, 5)

  return (
    <div className="mx-auto max-w-[1200px] px-10 py-10">
      <header className="mb-9 flex items-end justify-between gap-8">
        <div>
          <p className="eyebrow">Operaciones</p>
          <h1 className="mt-1.5 font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.028em] text-[var(--ink)]">
            Resumen de la plataforma
          </h1>
          <p className="mt-2 text-[13.5px] text-[var(--ink-muted)]">
            Datos en vivo de la flota Avoqado. Última actualización{' '}
            <span className="tabular text-[var(--ink)]">{formatDateTime(now)}</span>{' '}
            <span className="text-[var(--ink-faint)]">({timezoneShort(DEFAULT_TIMEZONE)})</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-[6px] border border-[var(--line)] bg-[var(--canvas-sunken)] px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] shadow-[0_0_0_3px_var(--success-faint)]" />
          <span className="text-[11.5px] font-medium text-[var(--ink-muted)]">
            API · saludable · 124 ms p50
          </span>
        </div>
      </header>

      <section
        aria-label="Indicadores"
        className="mb-10 grid grid-cols-1 gap-px overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4"
      >
        {KPIS.map((kpi) => (
          <article key={kpi.label} className="bg-[var(--canvas)] p-5">
            <p className="eyebrow">{kpi.label}</p>
            <p className="mt-3.5 font-display tabular text-[28px] font-semibold leading-none tracking-[-0.022em] text-[var(--ink)]">
              {kpi.value}
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
            {recent.map((entry, idx) => (
              <li
                key={entry.id}
                className={
                  idx === 0
                    ? 'flex items-start gap-4 p-4'
                    : 'flex items-start gap-4 border-t border-[var(--line)] p-4'
                }
              >
                <span
                  className={
                    'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ' +
                    (entry.severity === 'success'
                      ? 'bg-[var(--success)]'
                      : entry.severity === 'warn'
                        ? 'bg-[var(--warn)]'
                        : entry.severity === 'danger'
                          ? 'bg-[var(--danger)]'
                          : 'bg-[var(--ink-faint)]')
                  }
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-[var(--ink)]">
                    <span className="font-medium">{entry.actor.name}</span> · {entry.action}
                  </p>
                  {entry.target && (
                    <p className="mt-0.5 text-[11.5px] text-[var(--ink-muted)]">
                      → {entry.target.label}
                    </p>
                  )}
                </div>
                <p
                  className="tabular shrink-0 text-[11.5px] text-[var(--ink-faint)]"
                  title={formatDateTime(entry.occurredAt)}
                >
                  {formatRelative(entry.occurredAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <aside>
          <h2 className="mb-3 font-display text-[18px] font-semibold tracking-[-0.018em] text-[var(--ink)]">
            Necesita atención
          </h2>
          <div className="space-y-2.5">
            <AttentionCard
              tone="warn"
              title="6 KYC con más de 24 h sin revisar"
              meta="Don Toritos · Pulquería La Pirinola · 4 más"
              ctaTo="/kyc"
              ctaLabel="Revisar cola"
            />
            <AttentionCard
              tone="danger"
              title="Conciliación de settlement falló"
              meta="Diferencia · $1,283.40 MXN · reporte 2026-05-23"
              ctaTo="/activity-log"
              ctaLabel="Ver evento"
            />
            <AttentionCard
              tone="info"
              title="34 terminales pendientes de update 2.4.1"
              meta="Programado · esta noche 02:00 CST"
              ctaTo="/terminals"
              ctaLabel="Ver flota"
            />
          </div>
        </aside>
      </section>
    </div>
  )
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
      <span aria-hidden className={`mt-1 h-full w-[3px] shrink-0 self-stretch rounded-full ${accentBar}`} />
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
