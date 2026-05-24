import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  Landmark,
  Smartphone,
  Tag,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { buttonVariants } from '@/shared/ui/button-variants'
import { QueryError } from '@/shared/components/QueryError'
import { useVenueDetail } from './use-venues'

/**
 * Placeholder único que reserva las URLs futuras de configuración de
 * venue (owner / KYC / terminal / merchant / pricing). Cuando se construya
 * la pantalla real para cada recurso, sólo se reemplaza el componente en
 * `router.tsx` por el verdadero — la URL ya está fija, los mini-iconos
 * de `/venues` ya apuntan acá, y el `venueId` ya llega por params.
 *
 * El placeholder NO es un dead-end: muestra contexto del venue, qué se
 * iba a configurar, qué info estamos pasando al futuro componente, y un
 * CTA "Configurar desde el detail" para que el operador no quede atorado.
 */

type ResourceKey = 'owner' | 'kyc' | 'terminal' | 'merchant' | 'pricing'

interface ResourceCopy {
  /** Etiqueta breve para badge / título. */
  label: string
  /** Lo que el operador iba a hacer. */
  action: string
  /** Por qué importa. Una oración. */
  rationale: string
  /** Icono de lucide. */
  icon: LucideIcon
  /** Tono del badge — semantic. */
  tone: 'success' | 'warn' | 'danger' | 'info' | 'accent' | 'muted'
}

const RESOURCE_COPY: Record<ResourceKey, ResourceCopy> = {
  owner: {
    label: 'Owner',
    action: 'Asignar owner al venue',
    rationale:
      'El venue necesita un Staff con rol OWNER para poder operar legalmente y recibir notificaciones.',
    icon: UserRound,
    tone: 'accent',
  },
  kyc: {
    label: 'KYC',
    action: 'Subir documentos KYC',
    rationale:
      'Sin KYC verificado el venue no puede procesar pagos. Aquí se subirán los 4 docs obligatorios (INE, CSF, comprobante de domicilio, carátula bancaria) y los 2 adicionales si es Persona Moral (acta constitutiva, poder legal).',
    icon: ClipboardCheck,
    tone: 'warn',
  },
  terminal: {
    label: 'Terminal',
    action: 'Asignar terminal al venue',
    rationale:
      'Sin terminal el venue no puede cobrar con tarjeta física. Aquí se registra una TPV nueva (PAX A910s u otra) con su serial number y se vincula al venue.',
    icon: Smartphone,
    tone: 'info',
  },
  merchant: {
    label: 'Merchant',
    action: 'Vincular merchant account',
    rationale:
      'Los pagos del venue se liquidan a la merchant account vinculada (Blumon / Stripe / MercadoPago). Sin ella, los fondos no tienen destino.',
    icon: Landmark,
    tone: 'info',
  },
  pricing: {
    label: 'Pricing',
    action: 'Configurar comisiones',
    rationale:
      'El venue usa el pricing default de su organización. Aquí se configuran rates custom por método (débito / crédito / Amex / internacional), tarifa fija por transacción, y mensualidad si aplica.',
    icon: Tag,
    tone: 'muted',
  },
}

export function VenueResourcePlaceholder({ resource }: { resource: ResourceKey }) {
  const { venueId } = useParams<{ venueId: string }>()
  const query = useVenueDetail(venueId)
  const copy = RESOURCE_COPY[resource]

  if (!venueId) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-10">
        <p className="text-[14px] text-[var(--ink-muted)]">Falta venueId en la URL.</p>
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-10">
        <BackLink venueId={venueId} />
        <QueryError
          className="mt-5"
          error={query.error}
          context={`cargar el venue para configurar ${copy.label.toLowerCase()}`}
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      </div>
    )
  }

  const venue = query.data ?? null
  const Icon = copy.icon

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-6">
      <BackLink venueId={venueId} />

      <header className="mt-5">
        <div className="flex items-center gap-2">
          <Badge tone={copy.tone}>{copy.label}</Badge>
          <Badge tone="muted">Próximamente</Badge>
        </div>
        <h1 className="mt-3 font-display text-[28px] font-semibold leading-tight tracking-[-0.025em] text-[var(--ink)] sm:text-[32px]">
          {copy.action}
        </h1>
        {venue && (
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            para <span className="font-semibold text-[var(--ink)]">{venue.name}</span>{' '}
            <span className="text-[var(--ink-faint)]">·</span>{' '}
            <code className="font-mono text-[12.5px] text-[var(--ink-muted)]">{venue.slug}</code>
          </p>
        )}
      </header>

      <section
        className="mt-8 flex items-start gap-4 rounded-[8px] border border-dashed border-[var(--line-strong)] bg-[var(--canvas-sunken)] p-5"
        role="status"
      >
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-[var(--line)] bg-[var(--canvas)] text-[var(--ink-muted)]">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[16px] font-semibold tracking-[-0.012em] text-[var(--ink)]">
            Esta pantalla aún no está implementada
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-muted)]">
            {copy.rationale}
          </p>
          <div className="mt-4 rounded-[4px] border border-[var(--line)] bg-[var(--canvas)] p-3">
            <p className="label">Contexto que ya llega</p>
            <dl className="mt-2 space-y-1 text-[12.5px]">
              <div className="flex items-baseline gap-2">
                <dt className="shrink-0 text-[var(--ink-faint)]">venueId</dt>
                <dd className="min-w-0 truncate font-mono text-[var(--ink)]">{venueId}</dd>
              </div>
              {venue && (
                <>
                  <div className="flex items-baseline gap-2">
                    <dt className="shrink-0 text-[var(--ink-faint)]">organizationId</dt>
                    <dd className="min-w-0 truncate font-mono text-[var(--ink)]">
                      {venue.organizationId}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="shrink-0 text-[var(--ink-faint)]">venue.name</dt>
                    <dd className="min-w-0 truncate text-[var(--ink)]">{venue.name}</dd>
                  </div>
                </>
              )}
            </dl>
            <p className="mt-2.5 text-[11px] text-[var(--ink-faint)]">
              Cuando construyamos la pantalla, leerá este `venueId` directo de la URL y precargará
              todo el contexto del venue (no se pide al operador).
            </p>
          </div>
        </div>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link to={`/venues/${venueId}`} className={buttonVariants({ size: 'lg' })}>
          Ir al detalle del venue
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <Link
          to="/venues"
          className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-4 text-[13px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          Volver a la lista
        </Link>
      </div>
    </div>
  )
}

function BackLink({ venueId }: { venueId: string }) {
  return (
    <Link
      to={`/venues/${venueId}`}
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      Volver al venue
    </Link>
  )
}
