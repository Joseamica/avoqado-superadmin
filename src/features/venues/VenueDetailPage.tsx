import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, Mail, Phone, ShieldOff } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { QueryError } from '@/shared/components/QueryError'
import {
  formatDateTime,
  formatRelative,
  timezoneShort,
  DEFAULT_TIMEZONE,
} from '@/shared/lib/datetime'
import { cn } from '@/shared/lib/utils'
import { useVenueDetail } from './use-venues'
import {
  humanizeKycStatus,
  humanizeVenueStatus,
  isDemoVenue,
  isOperationalVenue,
  isSuspendedVenue,
  KYC_STATUS_TONE,
  ownerFullName,
  VENUE_STATUS_TONE,
  type Venue,
} from './types'

const MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})
const MXN_PRECISE = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
})
const NUM = new Intl.NumberFormat('es-MX')

/**
 * Detalle read-only de un venue.
 *
 * Iteración 1 — sólo lectura. Las quick actions (Aprobar KYC, Suspender,
 * Reactivar, Transferir) viven en el header pero quedan `disabled` con
 * `title="Próximamente"` hasta que en la iteración 2 las cableemos a las
 * mutations existentes en el backend (`POST /venues/:id/approve`,
 * `POST /venues/:id/suspend`, etc.).
 */
export function VenueDetailPage() {
  const { venueId } = useParams<{ venueId: string }>()
  const query = useVenueDetail(venueId)

  if (!venueId) {
    return (
      <div className="mx-auto max-w-[800px] px-4 py-10">
        <p className="text-[14px] text-[var(--ink-muted)]">Falta venueId en la URL.</p>
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-[800px] px-4 py-10">
        <BackLink />
        <QueryError
          className="mt-5"
          error={query.error}
          context="cargar el venue"
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      </div>
    )
  }

  if (!query.isLoading && query.data === null) {
    return (
      <div className="mx-auto max-w-[800px] px-4 py-10">
        <BackLink />
        <div className="mt-6 rounded-[8px] border border-[var(--line)] bg-[var(--canvas-sunken)] p-6">
          <p className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            Venue no encontrado
          </p>
          <p className="mt-2 text-[13px] text-[var(--ink-muted)]">
            El ID <code className="font-mono text-[12px] text-[var(--ink)]">{venueId}</code> no
            corresponde a ningún venue accesible. Pudo haberse cerrado o el ID está mal escrito.
          </p>
        </div>
      </div>
    )
  }

  const venue = query.data ?? null
  const isLoading = query.isLoading && !venue

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <BackLink />

      {isLoading ? <SkeletonHeader /> : venue ? <VenueHeader venue={venue} /> : null}

      {venue && (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <IdentitySection venue={venue} />
            <OwnerSection venue={venue} />
            {isSuspendedVenue(venue) && venue.suspensionReason && (
              <SuspensionSection venue={venue} />
            )}
          </div>
          <div className="space-y-6">
            <MetricsSection venue={venue} />
            <TimelineSection venue={venue} />
          </div>
        </div>
      )}

      {venue && (
        <div className="mt-10 border-t border-[var(--line)] pt-6">
          <p className="eyebrow mb-2">Próximos pasos</p>
          <ul className="space-y-1.5 text-[13px] text-[var(--ink-muted)]">
            <li>
              ·{' '}
              <Link
                to={`/activity-log?q=${encodeURIComponent(venue.slug)}`}
                className="text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Ver historial de acciones que mencionan este venue en el activity log
              </Link>
            </li>
            <li>
              ·{' '}
              <span className="text-[var(--ink-faint)]">
                Terminales, KYC docs, staff y pagos — próximamente (iteración 2)
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/venues"
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--accent)]"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      Venues
    </Link>
  )
}

function VenueHeader({ venue }: { venue: Venue }) {
  return (
    <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="eyebrow">Catálogo · Venue</p>
        <h1 className="mt-1.5 break-words font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] text-[var(--ink)] sm:text-[36px]">
          {venue.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <code className="font-mono text-[12px] text-[var(--ink-muted)]">{venue.slug}</code>
          <span className="text-[var(--ink-faint)]">·</span>
          <span className="text-[13px] text-[var(--ink-muted)]">{venue.organization.name}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Badge tone={VENUE_STATUS_TONE[venue.status]}>{humanizeVenueStatus(venue.status)}</Badge>
          {venue.kycStatus && (
            <Badge tone={KYC_STATUS_TONE[venue.kycStatus]}>
              KYC · {humanizeKycStatus(venue.kycStatus)}
            </Badge>
          )}
          {isDemoVenue(venue) && <Badge tone="info">Demo / ephemeral</Badge>}
          {isOperationalVenue(venue) && venue.monthlyTransactions > 0 && (
            <Badge tone="success">Recibiendo pagos</Badge>
          )}
          {venue.monthlyTransactions === 0 && isOperationalVenue(venue) && (
            <Badge tone="warn">Sin pagos este mes</Badge>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="md" disabled title="Próximamente">
          Cambiar comisión
        </Button>
        <Button type="button" variant="secondary" size="md" disabled title="Próximamente">
          {isSuspendedVenue(venue) ? 'Reactivar' : 'Suspender'}
        </Button>
      </div>
    </header>
  )
}

function SkeletonHeader() {
  return (
    <header className="mt-4">
      <p className="eyebrow">Catálogo · Venue</p>
      <div className="mt-2 h-9 w-72 animate-pulse rounded-[4px] bg-[var(--canvas-sunken)]" />
      <div className="mt-4 h-4 w-48 animate-pulse rounded-[4px] bg-[var(--canvas-sunken)]" />
    </header>
  )
}

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('rounded-[8px] border border-[var(--line)] bg-[var(--canvas)]', className)}
    >
      <header className="border-b border-[var(--line)] px-5 py-3">
        <h2 className="font-display text-[14px] font-semibold tracking-[-0.012em] text-[var(--ink)]">
          {title}
        </h2>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function DefinitionRow({
  label,
  value,
  mono,
  copyable,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  copyable?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] py-2.5 last:border-b-0">
      <p className="shrink-0 text-[11.5px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
        {label}
      </p>
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            'min-w-0 truncate text-right text-[13px] text-[var(--ink)]',
            mono && 'font-mono text-[12px]',
          )}
        >
          {value}
        </span>
        {copyable && (
          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) navigator.clipboard.writeText(copyable)
            }}
            aria-label={`Copiar ${label.toLowerCase()}`}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] text-[var(--ink-faint)] transition-colors hover:bg-[var(--canvas-sunken)] hover:text-[var(--ink)]"
          >
            <Copy className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}

function IdentitySection({ venue }: { venue: Venue }) {
  return (
    <Section title="Identidad">
      <DefinitionRow label="Venue ID" value={venue.id} mono copyable={venue.id} />
      <DefinitionRow label="Slug" value={venue.slug} mono copyable={venue.slug} />
      <DefinitionRow label="Organización" value={venue.organization.name} />
      <DefinitionRow
        label="Org ID"
        value={venue.organization.id}
        mono
        copyable={venue.organization.id}
      />
      <DefinitionRow
        label="Email org"
        value={
          <a href={`mailto:${venue.organization.email}`} className="hover:text-[var(--accent)]">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" aria-hidden />
              {venue.organization.email}
            </span>
          </a>
        }
      />
      {venue.organization.phone && (
        <DefinitionRow
          label="Tel org"
          value={
            <a href={`tel:${venue.organization.phone}`} className="hover:text-[var(--accent)]">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" aria-hidden />
                {venue.organization.phone}
              </span>
            </a>
          }
        />
      )}
    </Section>
  )
}

function OwnerSection({ venue }: { venue: Venue }) {
  const fullName = ownerFullName(venue.owner)
  return (
    <Section title="Owner principal">
      <DefinitionRow label="Nombre" value={fullName} />
      <DefinitionRow
        label="Email"
        value={
          <a href={`mailto:${venue.owner.email}`} className="hover:text-[var(--accent)]">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" aria-hidden />
              {venue.owner.email}
            </span>
          </a>
        }
        copyable={venue.owner.email}
      />
      {venue.owner.phone && (
        <DefinitionRow
          label="Teléfono"
          value={
            <a href={`tel:${venue.owner.phone}`} className="hover:text-[var(--accent)]">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" aria-hidden />
                {venue.owner.phone}
              </span>
            </a>
          }
        />
      )}
      <DefinitionRow label="Staff ID" value={venue.owner.id} mono copyable={venue.owner.id} />
      <p className="mt-3 text-[11px] text-[var(--ink-faint)]">
        El "owner" es el primer staff con rol ADMIN en el venue. Si hay varios admins, sólo se
        muestra uno aquí — el resto vive en el tab de Staff (próximamente).
      </p>
    </Section>
  )
}

function SuspensionSection({ venue }: { venue: Venue }) {
  return (
    <Section
      title={
        venue.status === 'ADMIN_SUSPENDED' ? 'Suspendido por Avoqado' : 'Pausado por el operador'
      }
      className="border-[var(--danger)]/40"
    >
      <div className="flex items-start gap-3">
        <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13px] text-[var(--ink)]">{venue.suspensionReason}</p>
          {venue.statusChangedAt && (
            <p className="mt-1 text-[11.5px] text-[var(--ink-faint)]">
              Suspendido {formatRelative(venue.statusChangedAt)} ·{' '}
              {formatDateTime(venue.statusChangedAt)}
            </p>
          )}
        </div>
      </div>
    </Section>
  )
}

function MetricsSection({ venue }: { venue: Venue }) {
  return (
    <Section title="Actividad del mes en curso">
      <div className="space-y-4">
        <div>
          <p className="eyebrow mb-1.5">Volumen procesado</p>
          <p className="font-display tabular text-[28px] font-semibold leading-none tracking-[-0.02em] text-[var(--ink)]">
            {venue.monthlyTransactions === 0 ? (
              <span className="text-[var(--ink-faint)]">Sin pagos</span>
            ) : (
              MXN.format(venue.monthlyRevenue)
            )}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--line)]">
          <div className="bg-[var(--canvas)] px-3 py-2.5">
            <p className="eyebrow">Pagos</p>
            <p className="tabular mt-1 text-[16px] font-semibold text-[var(--ink)]">
              {NUM.format(venue.monthlyTransactions)}
            </p>
          </div>
          <div className="bg-[var(--canvas)] px-3 py-2.5">
            <p className="eyebrow">AOV</p>
            <p className="tabular mt-1 text-[16px] font-semibold text-[var(--ink)]">
              {venue.averageOrderValue > 0 ? MXN_PRECISE.format(venue.averageOrderValue) : '—'}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-[var(--ink-faint)]">
          Datos de pagos COMPLETED del mes actual (zona {timezoneShort(DEFAULT_TIMEZONE)}). Cash
          también cuenta aquí — el corte por método se ve en el tab de Pagos.
        </p>
      </div>
    </Section>
  )
}

function TimelineSection({ venue }: { venue: Venue }) {
  return (
    <Section title="Cronología">
      <ol className="relative space-y-3 border-l border-[var(--line-strong)] pl-4">
        <TimelineEntry label="Creado" when={venue.createdAt} accent />
        {venue.statusChangedAt && venue.statusChangedAt !== venue.createdAt && (
          <TimelineEntry
            label={`Estado cambió a ${humanizeVenueStatus(venue.status)}`}
            when={venue.statusChangedAt}
          />
        )}
        {venue.updatedAt && venue.updatedAt !== venue.createdAt && (
          <TimelineEntry label="Última actualización" when={venue.updatedAt} muted />
        )}
      </ol>
      <p className="mt-4 text-[11px] text-[var(--ink-faint)]">
        Para el historial completo de acciones con quién las hizo, ve al{' '}
        <Link to="/activity-log" className="text-[var(--accent)] hover:underline">
          activity log
        </Link>
        .
      </p>
    </Section>
  )
}

function TimelineEntry({
  label,
  when,
  accent,
  muted,
}: {
  label: string
  when: string
  accent?: boolean
  muted?: boolean
}) {
  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -left-[20px] top-[6px] h-2 w-2 rounded-full border-2 border-[var(--canvas)]',
          accent
            ? 'bg-[var(--accent)] ring-2 ring-[var(--accent)]/30'
            : muted
              ? 'bg-[var(--ink-faint)]'
              : 'bg-[var(--ink-muted)]',
        )}
      />
      <p className="text-[12.5px] text-[var(--ink)]">{label}</p>
      <p className="tabular mt-0.5 text-[11px] text-[var(--ink-faint)]">
        {formatRelative(when)} · {formatDateTime(when)}
      </p>
    </li>
  )
}
