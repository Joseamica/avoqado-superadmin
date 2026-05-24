import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/utils'
import { formatRelative } from '@/shared/lib/datetime'
import {
  humanizeKycStatus,
  humanizeVenueStatus,
  inspectOwner,
  KYC_STATUS_TONE,
  VENUE_STATUS_TONE,
  type Venue,
} from './types'
import { SetupCounter } from './SetupIcons'

/**
 * Vista alterna al `<DataTable>` plano cuando el superadmin pidió
 * "agrupar por organización".
 *
 * Trade-offs vs flat:
 *   - Flat: search global, sort por columna, export CSV — vista de inspección.
 *   - Grouped: contexto agregado por org (cuántos venues tiene, cuánto procesan
 *     en suma), rows más compactas (single-line), sin search ni export — vista
 *     de "browsing" del catálogo. Para buscar / exportar, volver a flat.
 *
 * Los venues que llegan aquí ya pasaron por los filtros (Estado, KYC, Vista) —
 * la org se queda con los venues que sobrevivieron, y si una org quedó sin
 * venues, no se renderiza la sección entera.
 */

interface VenuesByOrgListProps {
  venues: Venue[]
}

const MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})
const NUM = new Intl.NumberFormat('es-MX')

interface OrgGroup {
  id: string
  name: string
  venues: Venue[]
  totalRevenue: number
  totalTransactions: number
  /** Timestamp del venue más reciente (createdAt o statusChangedAt — lo que sea más nuevo). */
  lastActivity: string
}

function groupByOrganization(venues: Venue[]): OrgGroup[] {
  const byId = new Map<string, OrgGroup>()
  for (const v of venues) {
    const existing = byId.get(v.organizationId)
    const lastForThis =
      v.statusChangedAt && v.statusChangedAt > v.createdAt ? v.statusChangedAt : v.createdAt
    if (existing) {
      existing.venues.push(v)
      existing.totalRevenue += v.monthlyRevenue
      existing.totalTransactions += v.monthlyTransactions
      if (lastForThis > existing.lastActivity) existing.lastActivity = lastForThis
    } else {
      byId.set(v.organizationId, {
        id: v.organizationId,
        name: v.organization.name,
        venues: [v],
        totalRevenue: v.monthlyRevenue,
        totalTransactions: v.monthlyTransactions,
        lastActivity: lastForThis,
      })
    }
  }
  // Orden por volumen mes desc — el operador busca primero "quién está procesando
  // más esta semana". Empate → más venues primero → alfabético.
  return [...byId.values()].sort((a, b) => {
    if (a.totalRevenue !== b.totalRevenue) return b.totalRevenue - a.totalRevenue
    if (a.venues.length !== b.venues.length) return b.venues.length - a.venues.length
    return a.name.localeCompare(b.name)
  })
}

export function VenuesByOrgList({ venues }: VenuesByOrgListProps) {
  const groups = useMemo(() => groupByOrganization(venues), [venues])
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
          Sin organizaciones que mostrar
        </p>
        <p className="mt-1.5 text-[13px] text-[var(--ink-muted)]">
          Los filtros activos no dejan venues visibles. Ajustalos o limpiá la selección.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8" role="list" aria-label="Venues agrupados por organización">
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
                    aria-controls={`org-${group.id}-venues`}
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
                    {group.name}
                  </h2>
                </div>
                <p className="tabular ml-9 mt-1 text-[12px] text-[var(--ink-muted)]">
                  {NUM.format(group.venues.length)} {group.venues.length === 1 ? 'venue' : 'venues'}
                  <span className="mx-1.5 text-[var(--ink-faint)]">·</span>
                  {group.totalTransactions > 0 ? (
                    <>
                      <span className="font-semibold text-[var(--ink)]">
                        {MXN.format(group.totalRevenue)}
                      </span>{' '}
                      en el mes
                      <span className="mx-1.5 text-[var(--ink-faint)]">·</span>
                      {NUM.format(group.totalTransactions)}{' '}
                      {group.totalTransactions === 1 ? 'pago' : 'pagos'}
                    </>
                  ) : (
                    <span className="text-[var(--ink-faint)]">sin movimiento este mes</span>
                  )}
                </p>
              </div>
            </header>

            {!isCollapsed && (
              <ul id={`org-${group.id}-venues`} className="space-y-px">
                {group.venues.map((venue) => (
                  <VenueRow key={venue.id} venue={venue} />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function VenueRow({ venue }: { venue: Venue }) {
  const owner = inspectOwner(venue.owner)
  const kyc = venue.kycStatus
  const showKycPill = kyc !== 'VERIFIED'
  const hasMovement = venue.monthlyTransactions > 0

  return (
    <li>
      <Link
        to={`/venues/${venue.id}`}
        className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 gap-y-1 rounded-[4px] px-3 py-2.5 text-[13px] transition-colors hover:bg-[var(--canvas-sunken)] sm:grid-cols-[1.4fr_auto_140px_140px_120px]"
      >
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--ink)]">{venue.name}</p>
          <p className="tabular truncate font-mono text-[10.5px] text-[var(--ink-faint)]">
            {venue.slug}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={VENUE_STATUS_TONE[venue.status]}>{humanizeVenueStatus(venue.status)}</Badge>
          {showKycPill &&
            (kyc ? (
              <Badge tone={KYC_STATUS_TONE[kyc]}>KYC · {humanizeKycStatus(kyc)}</Badge>
            ) : (
              <Badge tone="muted">Sin KYC</Badge>
            ))}
          <SetupCounter venue={venue} />
        </div>

        {/* Volumen — sólo visible ≥ sm. En mobile cae a "Sin pagos" / monto en
            la sección Owner. */}
        <div className="hidden text-right sm:block">
          {hasMovement ? (
            <>
              <p className="tabular font-semibold text-[var(--ink)]">
                {MXN.format(venue.monthlyRevenue)}
              </p>
              <p className="tabular text-[10.5px] text-[var(--ink-faint)]">
                {NUM.format(venue.monthlyTransactions)}{' '}
                {venue.monthlyTransactions === 1 ? 'pago' : 'pagos'}
              </p>
            </>
          ) : (
            <span className="text-[11.5px] text-[var(--ink-faint)]">—</span>
          )}
        </div>

        {/* Owner — siempre visible pero más compacto. */}
        <div className="hidden min-w-0 sm:block">
          {owner.kind === 'real' ? (
            <>
              <p className="truncate text-[12px] text-[var(--ink-muted)]">{owner.name}</p>
              <p className="truncate text-[10.5px] text-[var(--ink-faint)]">{owner.email}</p>
            </>
          ) : (
            <p className="text-[11.5px] italic text-[var(--ink-faint)]">Sin owner</p>
          )}
        </div>

        <p className="tabular hidden text-right text-[11px] text-[var(--ink-faint)] sm:block">
          {formatRelative(venue.createdAt)}
        </p>
      </Link>
    </li>
  )
}
