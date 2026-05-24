/**
 * Sistema de filtros estilo Stripe.
 *
 * Patrón de uso:
 *
 * ```tsx
 * <div className="flex flex-wrap items-center gap-2">
 *   <FilterPill
 *     label="Estado"
 *     activeLabel={statuses.size > 0 ? formatStatuses(statuses) : null}
 *     activeCount={statuses.size}
 *     onClear={() => setStatuses(new Set())}
 *   >
 *     <MultiSelectFilterContent
 *       title="Filtrar por estado"
 *       options={STATUS_OPTIONS}
 *       selected={statuses}
 *       onApply={setStatuses}
 *     />
 *   </FilterPill>
 * </div>
 * ```
 *
 * Convenciones:
 * - El pill **inactivo** dice "+ Etiqueta" en muted.
 * - El pill **activo** dice "[×] Etiqueta | Valor ▾" en colores invertidos.
 * - Multi-select aplica en batch (footer Apply); single-select aplica al click.
 * - El `onClose` del content es inyectado por `FilterPill` — no lo pasa el caller.
 */

export { FilterPill, FilterPopoverHeader, FilterPopoverFooter } from './FilterPill'
export { MultiSelectFilterContent, type MultiSelectOption } from './MultiSelectFilterContent'
export { SingleSelectFilterContent, type SingleSelectOption } from './SingleSelectFilterContent'
