import { useMemo, useState } from 'react'
import { ArrowUpRight, Filter, Search } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Kbd } from '@/components/ui/Kbd'
import {
  DEFAULT_TIMEZONE,
  formatDateTime,
  formatRelative,
  timezoneShort,
} from '@/lib/datetime'
import { cn } from '@/lib/utils'
import {
  MOCK_ACTIVITY,
  type ActivityCategory,
  type ActivityEntry,
  type ActivitySeverity,
} from './ActivityLogPage.mock'

const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  kyc: 'KYC',
  venue: 'Venue',
  terminal: 'Terminal',
  payment: 'Pago',
  auth: 'Auth',
  config: 'Config',
}

const SEVERITY_TONE: Record<
  ActivitySeverity,
  'muted' | 'success' | 'warn' | 'danger' | 'info'
> = {
  info: 'info',
  success: 'success',
  warn: 'warn',
  danger: 'danger',
}

const CATEGORIES: (ActivityCategory | 'all')[] = [
  'all',
  'kyc',
  'venue',
  'terminal',
  'payment',
  'auth',
  'config',
]

export function ActivityLogPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ActivityCategory | 'all'>('all')

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    return MOCK_ACTIVITY.filter((e) => {
      if (category !== 'all' && e.category !== category) return false
      if (!q) return true
      return (
        e.action.toLowerCase().includes(q) ||
        e.actor.name.toLowerCase().includes(q) ||
        e.target?.label.toLowerCase().includes(q) ||
        e.venue?.name.toLowerCase().includes(q)
      )
    })
  }, [query, category])

  return (
    <div className="mx-auto max-w-[1200px] px-10 py-10">
      <header className="mb-7 flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Auditoría</p>
          <h1 className="mt-1.5 font-display text-[34px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)]">
            Activity log
          </h1>
          <p className="mt-2 text-[13.5px] text-[var(--ink-muted)]">
            Cada acción registrada por el equipo y los procesos del sistema, en tiempo real.
            <span className="tabular ml-2 text-[var(--ink-faint)]">
              · zona base {timezoneShort(DEFAULT_TIMEZONE)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="md">
            Exportar CSV
          </Button>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-faint)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar acción, actor, venue…"
            className="h-9 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] pl-9 pr-3 text-[13px] placeholder:text-[var(--ink-faint)] focus-visible:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-[6px] border border-[var(--line)] bg-[var(--canvas)] p-0.5">
          <Filter className="mx-1.5 h-3.5 w-3.5 text-[var(--ink-faint)]" />
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                'h-7 rounded-[4px] px-2 text-[11.5px] font-medium uppercase tracking-[0.06em] transition-colors',
                category === c
                  ? 'bg-[var(--ink)] text-[var(--canvas)]'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]',
              )}
            >
              {c === 'all' ? 'Todo' : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line-strong)] bg-[var(--canvas-sunken)]">
              <Th className="w-[140px]">Cuándo</Th>
              <Th className="w-[180px]">Actor</Th>
              <Th className="w-[110px]">Categoría</Th>
              <Th>Acción</Th>
              <Th className="w-[180px]">Origen</Th>
              <Th className="w-[40px]"></Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center">
                  <p className="font-display text-[15px] font-semibold text-[var(--ink)]">
                    Sin coincidencias
                  </p>
                  <p className="mt-1 text-[12.5px] text-[var(--ink-faint)]">
                    Ajusta el filtro o limpia la búsqueda para volver a ver todo el log.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <footer className="mt-3 flex items-center justify-between text-[11.5px] text-[var(--ink-faint)]">
        <span className="tabular">
          {entries.length} de {MOCK_ACTIVITY.length} eventos
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>K</Kbd>
          <span>anterior</span>
          <span className="mx-1.5 opacity-50">·</span>
          <Kbd>J</Kbd>
          <span>siguiente</span>
        </span>
      </footer>
    </div>
  )
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[var(--ink-faint)]',
        className,
      )}
    >
      {children}
    </th>
  )
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const tz = entry.venue?.timezone ?? DEFAULT_TIMEZONE
  return (
    <tr className="group border-b border-[var(--line)] transition-colors last:border-b-0 hover:bg-[var(--canvas-sunken)]/60">
      <td className="px-4 py-3 align-top">
        <p className="tabular text-[12.5px] text-[var(--ink)]">
          {formatRelative(entry.occurredAt, tz)}
        </p>
        <p
          className="mt-0.5 tabular text-[10.5px] text-[var(--ink-faint)]"
          title={`${formatDateTime(entry.occurredAt, tz)} · ${timezoneShort(tz)}`}
        >
          {formatDateTime(entry.occurredAt, tz)}
        </p>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-[12.5px] font-medium text-[var(--ink)]">{entry.actor.name}</p>
        <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">{entry.actor.email}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <Badge tone={SEVERITY_TONE[entry.severity]}>{CATEGORY_LABEL[entry.category]}</Badge>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-[13px] leading-snug text-[var(--ink)]">{entry.action}</p>
        {entry.target && (
          <p className="mt-1 text-[11.5px] text-[var(--ink-muted)]">
            {entry.target.href ? (
              <a
                href={entry.target.href}
                className="border-b border-dashed border-[var(--ink-faint)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {entry.target.label}
              </a>
            ) : (
              entry.target.label
            )}
          </p>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <p className="font-mono text-[11.5px] tabular text-[var(--ink-muted)]">
          {entry.source.ip}
        </p>
        <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.08em] text-[var(--ink-faint)]">
          {entry.source.device}
        </p>
      </td>
      <td className="px-4 py-3 align-top text-right">
        <button
          type="button"
          aria-label="Ver detalle"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[var(--ink-faint)] opacity-0 transition-opacity hover:bg-[var(--canvas-sunken)] hover:text-[var(--ink)] group-hover:opacity-100"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}
