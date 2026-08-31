import { Badge } from '@/shared/ui/Badge'
import type { AudienceFilters as Filters, AudienceRole, BusinessCategory, PlanTier } from './types'

const ROLES: Array<{ value: AudienceRole; label: string }> = [
  { value: 'OWNER', label: 'Dueño' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Gerente' },
  { value: 'CASHIER', label: 'Cajero' },
  { value: 'WAITER', label: 'Mesero' },
]

const PLANES: Array<{ value: PlanTier; label: string }> = [
  { value: 'GRATIS', label: 'Gratis' },
  { value: 'PRO', label: 'PRO' },
  { value: 'PREMIUM', label: 'Premium' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
]

const GIROS: Array<{ value: BusinessCategory; label: string }> = [
  { value: 'FOOD_SERVICE', label: 'Restaurantes' },
  { value: 'RETAIL', label: 'Tiendas' },
  { value: 'SERVICES', label: 'Servicios' },
  { value: 'HOSPITALITY', label: 'Hospedaje' },
  { value: 'ENTERTAINMENT', label: 'Entretenimiento' },
  { value: 'OTHER', label: 'Otros' },
]

function Chips<T extends string>({
  opciones,
  seleccion,
  onToggle,
  onTodos,
  /**
   * Qué significa "Todos" en este grupo:
   *  - `vacio`  → limpiar la selección, porque vacío YA quiere decir todos (plan, giro).
   *  - `llenar` → encender todas las opciones, porque vacío no es válido (roles).
   */
  modoTodos,
}: {
  opciones: Array<{ value: T; label: string }>
  seleccion: T[]
  onToggle: (v: T) => void
  onTodos: () => void
  modoTodos: 'vacio' | 'llenar'
}) {
  const todosActivo =
    modoTodos === 'vacio' ? seleccion.length === 0 : seleccion.length === opciones.length

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onTodos}
        aria-pressed={todosActivo}
        className={
          todosActivo
            ? 'inline-flex h-8 items-center rounded-full border border-[var(--line-strong)] bg-[var(--surface-primary)] px-3 text-[12px] font-medium text-[var(--on-surface-primary)] transition-colors'
            : 'inline-flex h-8 items-center rounded-full border border-dashed border-[var(--line-strong)] px-3 text-[12px] text-[var(--ink-muted)] transition-colors hover:border-[var(--ink-faint)] hover:text-[var(--ink)]'
        }
      >
        Todos
      </button>
      {opciones.map((o) => {
        const activo = seleccion.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            aria-pressed={activo}
            className={
              activo
                ? 'inline-flex h-8 items-center rounded-full border border-[var(--line-strong)] bg-[var(--surface-primary)] px-3 text-[12px] font-medium text-[var(--on-surface-primary)] transition-colors'
                : 'inline-flex h-8 items-center rounded-full border border-[var(--line-strong)] px-3 text-[12px] text-[var(--ink-muted)] transition-colors hover:border-[var(--ink-faint)] hover:text-[var(--ink)]'
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Los filtros de audiencia, con el conteo en vivo al lado.
 *
 * 🔴 Se muestran DOS números distintos a propósito: una persona puede administrar varios
 * negocios, así que "37 negocios" y "37 personas" casi nunca coinciden. Enseñar uno solo
 * haría creer que son lo mismo.
 */
export function AudienceFiltersEditor({
  filters,
  onChange,
  preview,
  cargando,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  preview?: { venues: number; people: number }
  cargando: boolean
}) {
  const toggle = <K extends keyof Filters>(key: K, valor: Filters[K][number]) => {
    const actual = filters[key] as string[]
    const nuevo = actual.includes(valor as string)
      ? actual.filter((v) => v !== valor)
      : [...actual, valor as string]
    onChange({ ...filters, [key]: nuevo } as Filters)
  }

  const sinFiltroDeAlcance =
    filters.targetPlanTiers.length === 0 &&
    filters.targetCategories.length === 0 &&
    filters.targetVenueIds.length === 0

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 text-[12px] text-[var(--ink-muted)]">
          Quién lo ve dentro del negocio
        </div>
        <Chips
          opciones={ROLES}
          seleccion={filters.audienceRoles}
          onToggle={(v) => toggle('audienceRoles', v)}
          // En roles NO se puede dejar vacío (el servidor exige al menos uno), así que
          // "Todos" enciende los cinco.
          modoTodos="llenar"
          onTodos={() => onChange({ ...filters, audienceRoles: ROLES.map((r) => r.value) })}
        />
        {filters.audienceRoles.length === 0 && (
          <p className="mt-1.5 text-[12px] text-[var(--danger)]">Elige al menos un rol.</p>
        )}
      </div>

      <div>
        <div className="mb-1.5 text-[12px] text-[var(--ink-muted)]">Plan · vacío = todos</div>
        <Chips
          opciones={PLANES}
          seleccion={filters.targetPlanTiers}
          onToggle={(v) => toggle('targetPlanTiers', v)}
          // Vacío YA significa todos: "Todos" limpia en vez de encender los cuatro.
          modoTodos="vacio"
          onTodos={() => onChange({ ...filters, targetPlanTiers: [] })}
        />
      </div>

      <div>
        <div className="mb-1.5 text-[12px] text-[var(--ink-muted)]">Giro · vacío = todos</div>
        <Chips
          opciones={GIROS}
          seleccion={filters.targetCategories}
          onToggle={(v) => toggle('targetCategories', v)}
          modoTodos="vacio"
          onTodos={() => onChange({ ...filters, targetCategories: [] })}
        />
      </div>

      <div className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas-raised)] px-3.5 py-3">
        {cargando ? (
          <span className="text-[13px] text-[var(--ink-muted)]">Contando…</span>
        ) : preview ? (
          <div className="flex items-baseline gap-4">
            <span className="text-[13px] text-[var(--ink)]">
              Le llega a <strong>{preview.venues}</strong>{' '}
              {preview.venues === 1 ? 'negocio' : 'negocios'}
            </span>
            <span className="text-[13px] text-[var(--ink-muted)]">
              {preview.people} {preview.people === 1 ? 'persona' : 'personas'}
            </span>
            {preview.venues === 0 && <Badge tone="warn">Nadie lo recibiría</Badge>}
          </div>
        ) : (
          <span className="text-[13px] text-[var(--ink-muted)]">
            Elige un rol para ver el alcance
          </span>
        )}
        {sinFiltroDeAlcance && preview && preview.venues > 0 && (
          <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
            Sin filtros de plan ni giro: va a todos.
          </p>
        )}
      </div>
    </div>
  )
}
