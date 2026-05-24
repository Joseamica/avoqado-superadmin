import { Link } from 'react-router-dom'
import {
  CircleDashed,
  CircleEllipsis,
  ClipboardCheck,
  Landmark,
  Smartphone,
  Tag,
  UserRound,
} from 'lucide-react'
import { Tooltip } from '@/shared/ui/Tooltip'
import { cn } from '@/shared/lib/utils'
import type { Venue, VenueCompleteness } from './types'

/**
 * Tira horizontal de mini-iconos que muestra de un vistazo qué tiene
 * configurado el venue y qué falta:
 *
 *   [👤] [🛡️] [📟] [💳] [💲]
 *    on   on   off  off  off
 *
 * Cada icono es clickeable. Cuando el flag está en `false`, lleva al
 * detalle del venue con un query param `?focus=<area>` para que la
 * pantalla de detalle abra/scroll a la sección correspondiente cuando
 * exista. Hasta entonces el operador llega al detail y ve qué falta.
 *
 * Cuando el venue NO trae el bloque `completeness` (endpoint legacy
 * sin migrar, error temporal), pintamos los 5 íconos en estado
 * "indeterminado" para que el operador sepa que no es info confiable.
 */

interface SetupIconsProps {
  venue: Venue
}

interface IconDef {
  key: keyof VenueCompleteness
  label: string
  description: { ok: string; missing: string; unknown: string }
  icon: typeof UserRound
  /**
   * Subpath bajo `/venues/:venueId/` de la pantalla dedicada a configurar
   * este recurso. Hoy todas estas rutas montan `<VenueResourcePlaceholder>`
   * — cuando construyamos las pantallas reales se reemplaza el element en
   * `router.tsx` y el icono ya apunta correcto.
   */
  configurePath: string
}

const ICONS: IconDef[] = [
  {
    key: 'hasOwner',
    label: 'Owner',
    description: {
      ok: 'Owner asignado',
      missing: 'Falta Staff con rol OWNER',
      unknown: 'No sabemos si tiene owner — backend antiguo',
    },
    icon: UserRound,
    configurePath: 'owner',
  },
  {
    key: 'kycVerified',
    label: 'KYC',
    description: {
      ok: 'KYC verificado',
      missing: 'KYC no verificado — pendiente o rechazado',
      unknown: 'KYC desconocido',
    },
    icon: ClipboardCheck,
    configurePath: 'kyc',
  },
  {
    key: 'hasTerminal',
    label: 'Terminal',
    description: {
      ok: 'Terminal asignada',
      missing: 'Sin terminal — el venue no puede cobrar con tarjeta física',
      unknown: 'Terminales desconocido',
    },
    icon: Smartphone,
    configurePath: 'terminals/new',
  },
  {
    key: 'hasMerchantAccount',
    label: 'Merchant',
    description: {
      ok: 'Merchant account vinculada',
      missing: 'Sin merchant — los pagos no se liquidan a ninguna cuenta',
      unknown: 'Merchant account desconocido',
    },
    icon: Landmark,
    configurePath: 'merchant',
  },
  {
    key: 'hasPricing',
    label: 'Pricing',
    description: {
      ok: 'Comisiones configuradas',
      missing: 'Sin comisiones — usará default global',
      unknown: 'Pricing desconocido',
    },
    icon: Tag,
    configurePath: 'pricing',
  },
]

export function SetupIcons({ venue }: SetupIconsProps) {
  const completeness = venue.completeness
  const hasData = !!completeness

  return (
    <ul className="flex items-center gap-1.5" aria-label={`Setup del venue ${venue.name}`}>
      {ICONS.map((def) => {
        const status: 'ok' | 'missing' | 'unknown' = !hasData
          ? 'unknown'
          : completeness[def.key]
            ? 'ok'
            : 'missing'

        // Cuando es `missing`: navega a la pantalla dedicada (`/venues/:id/<resource>`)
        // donde el operador configura ese recurso específico. Hoy es un
        // `<VenueResourcePlaceholder>`; cuando se construya la pantalla real
        // se reemplaza el `element` del Route y el icono ya apunta correcto.
        // Cuando es `ok` o `unknown`: navega al detail del venue.
        const href =
          status === 'missing' ? `/venues/${venue.id}/${def.configurePath}` : `/venues/${venue.id}`

        return (
          <li key={def.key}>
            <Tooltip
              content={
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] font-semibold text-[var(--canvas)]/60">{def.label}</p>
                  <p>{def.description[status]}</p>
                  {status === 'missing' && (
                    <p className="mt-0.5 text-[10.5px] text-[var(--canvas)]/50">
                      Click → configurar {def.label.toLowerCase()}
                    </p>
                  )}
                </div>
              }
            >
              <Link
                to={href}
                aria-label={def.description[status]}
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-[4px] border transition-colors',
                  status === 'ok' &&
                    'border-[var(--line-strong)] bg-[var(--surface-primary)] text-[var(--on-surface-primary)] hover:bg-[var(--surface-primary-hover)]',
                  status === 'missing' &&
                    'border-[var(--line)] bg-[var(--canvas-sunken)] text-[var(--ink-faint)] hover:border-[var(--accent-line)] hover:bg-[var(--accent-faint)] hover:text-[var(--accent)]',
                  status === 'unknown' &&
                    'border-dashed border-[var(--line)] bg-[var(--canvas)] text-[var(--ink-faint)] hover:text-[var(--ink-muted)]',
                )}
              >
                {status === 'unknown' ? (
                  <CircleEllipsis className="h-3.5 w-3.5" aria-hidden />
                ) : status === 'missing' ? (
                  <def.icon className="h-3.5 w-3.5" aria-hidden strokeWidth={1.5} />
                ) : (
                  <def.icon className="h-3.5 w-3.5" aria-hidden />
                )}
              </Link>
            </Tooltip>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Variante chiquita para tablas — muestra solo un contador "3/5" cuando
 * no quieras gastar el ancho horizontal en 5 íconos. Útil para vista mobile
 * o columnas estrechas.
 */
export function SetupCounter({ venue }: SetupIconsProps) {
  const c = venue.completeness
  if (!c) {
    return (
      <Tooltip content="El backend no reportó el estado de setup de este venue.">
        <span
          className="inline-flex cursor-help items-center gap-1 text-[11.5px] text-[var(--ink-faint)]"
          tabIndex={0}
        >
          <CircleDashed className="h-3 w-3" aria-hidden />
          <span>?</span>
        </span>
      </Tooltip>
    )
  }
  const total = 5
  const checks = ICONS.map((def) => ({ label: def.label, done: !!c[def.key] }))
  const done = checks.filter((x) => x.done).length
  const ratio = done / total
  const missing = checks.filter((x) => !x.done).map((x) => x.label)
  return (
    <Tooltip
      content={
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-semibold text-[var(--canvas)]/60">
            Setup · {done} de {total}
          </p>
          {missing.length === 0 ? <p>Todo configurado.</p> : <p>Falta: {missing.join(', ')}.</p>}
        </div>
      }
    >
      <span
        className={cn(
          'tabular inline-flex cursor-help items-center text-[12px] font-semibold',
          ratio === 1
            ? 'text-[var(--success)]'
            : ratio >= 0.6
              ? 'text-[var(--ink)]'
              : 'text-[var(--warn)]',
        )}
        tabIndex={0}
      >
        {done}/{total}
      </span>
    </Tooltip>
  )
}
