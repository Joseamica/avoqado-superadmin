import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/utils'
import { formatRelative } from '@/shared/lib/datetime'
import {
  canBeActivated,
  humanizeTerminalStatus,
  humanizeTerminalType,
  isTerminalOnline,
  TERMINAL_STATUS_TONE,
  TERMINAL_TYPE_TONE,
  type Terminal,
} from './types'

/**
 * Vista alterna a la tabla plana — agrupa terminals por su venue padre.
 * El header de cada sección muestra "X terminals · N online · M sin activar".
 * Cada terminal queda como row clickeable que abre el drawer de acciones.
 *
 * Click en un terminal NO navega — invoca `onSelectTerminal` que el padre
 * usa para abrir el drawer. Mantenemos el contexto de la lista atrás.
 */

interface TerminalsByVenueListProps {
  terminals: Terminal[]
  onSelectTerminal: (t: Terminal) => void
}

const NUM = new Intl.NumberFormat('es-MX')

interface VenueGroup {
  id: string
  name: string
  slug: string
  terminals: Terminal[]
  onlineCount: number
  pendingCount: number
}

function groupByVenue(terminals: Terminal[]): VenueGroup[] {
  const byId = new Map<string, VenueGroup>()
  for (const t of terminals) {
    const existing = byId.get(t.venueId)
    const isOnline = isTerminalOnline(t)
    const isPending = canBeActivated(t)
    if (existing) {
      existing.terminals.push(t)
      if (isOnline) existing.onlineCount += 1
      if (isPending) existing.pendingCount += 1
    } else {
      byId.set(t.venueId, {
        id: t.venueId,
        name: t.venue.name,
        slug: t.venue.slug,
        terminals: [t],
        onlineCount: isOnline ? 1 : 0,
        pendingCount: isPending ? 1 : 0,
      })
    }
  }
  // Sort: venues con más terminals sin activar primero (atención requerida),
  // luego por count de terminals, luego alfabético.
  return [...byId.values()].sort((a, b) => {
    if (a.pendingCount !== b.pendingCount) return b.pendingCount - a.pendingCount
    if (a.terminals.length !== b.terminals.length) {
      return b.terminals.length - a.terminals.length
    }
    return a.name.localeCompare(b.name)
  })
}

export function TerminalsByVenueList({ terminals, onSelectTerminal }: TerminalsByVenueListProps) {
  const groups = useMemo(() => groupByVenue(terminals), [terminals])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (groups.length === 0) {
    return (
      <div className="rounded-[8px] border border-[var(--line)] bg-[var(--canvas-sunken)] p-8 text-center">
        <p className="font-display text-[18px] font-semibold tracking-[-0.018em] text-[var(--ink)]">
          Sin terminals que mostrar
        </p>
        <p className="mt-1.5 text-[13px] text-[var(--ink-muted)]">
          Los filtros activos no dejan terminals visibles. Ajustalos o limpiá la selección.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8" role="list" aria-label="Terminals agrupados por venue">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.id)
        return (
          <section
            key={group.id}
            role="listitem"
            className="border-t border-[var(--line-strong)] pt-4"
          >
            <header className="mb-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(group.id)}
                    aria-expanded={!isCollapsed}
                    aria-controls={`venue-${group.id}-terminals`}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] text-[var(--ink-faint)] transition-colors hover:bg-[var(--canvas-sunken)] hover:text-[var(--ink)]"
                  >
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform',
                        isCollapsed && '-rotate-90',
                      )}
                      aria-hidden
                    />
                  </button>
                  <h2 className="truncate font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                    <Link to={`/venues/${group.id}`} className="hover:text-[var(--accent)]">
                      {group.name}
                    </Link>
                  </h2>
                </div>
                <p className="tabular ml-9 mt-1 text-[12px] text-[var(--ink-muted)]">
                  {NUM.format(group.terminals.length)}{' '}
                  {group.terminals.length === 1 ? 'terminal' : 'terminals'}
                  <span className="mx-1.5 text-[var(--ink-faint)]">·</span>
                  <span className="text-[var(--success)]">
                    {NUM.format(group.onlineCount)} online
                  </span>
                  {group.pendingCount > 0 && (
                    <>
                      <span className="mx-1.5 text-[var(--ink-faint)]">·</span>
                      <span className="text-[var(--warn)]">
                        {NUM.format(group.pendingCount)} sin activar
                      </span>
                    </>
                  )}
                </p>
              </div>
            </header>

            {!isCollapsed && (
              <ul id={`venue-${group.id}-terminals`} className="space-y-px">
                {group.terminals.map((t) => (
                  <TerminalRow key={t.id} terminal={t} onClick={() => onSelectTerminal(t)} />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function TerminalRow({ terminal, onClick }: { terminal: Terminal; onClick: () => void }) {
  const online = isTerminalOnline(terminal)
  const pending = canBeActivated(terminal)
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 rounded-[4px] px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-[var(--canvas-sunken)] sm:grid-cols-[auto_1.4fr_auto_140px_120px]"
      >
        <span
          aria-hidden
          className={cn(
            'inline-block h-2 w-2 shrink-0 rounded-full',
            pending
              ? 'bg-[var(--warn)] shadow-[0_0_0_2px_var(--warn-faint)]'
              : online
                ? 'bg-[var(--success)] shadow-[0_0_0_2px_var(--success-faint)]'
                : 'bg-[var(--ink-faint)] shadow-[0_0_0_2px_var(--line)]',
          )}
          title={pending ? 'Sin activar' : online ? 'Online' : 'Offline'}
        />
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--ink)]">{terminal.name}</p>
          <p className="tabular truncate font-mono text-[10.5px] text-[var(--ink-faint)]">
            {terminal.serialNumber || 'Sin serial'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={TERMINAL_TYPE_TONE[terminal.type]}>
            {humanizeTerminalType(terminal.type)}
          </Badge>
          <Badge tone={TERMINAL_STATUS_TONE[terminal.status]}>
            {humanizeTerminalStatus(terminal.status)}
          </Badge>
        </div>
        <p className="tabular hidden font-mono text-[11px] text-[var(--ink-muted)] sm:block">
          {terminal.version || '—'}
        </p>
        <p className="tabular hidden text-right text-[11px] text-[var(--ink-faint)] sm:block">
          {terminal.lastHeartbeat ? formatRelative(terminal.lastHeartbeat) : 'Nunca'}
        </p>
      </button>
    </li>
  )
}
