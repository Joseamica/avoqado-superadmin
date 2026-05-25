import { cn } from '@/shared/lib/utils'

export type IconButtonSize = 'sm' | 'md'

/**
 * Base class para CUALQUIER botón icon-only (acción de fila, copy, menú,
 * cerrar, mini-indicadores). Compartida por <IconButton> (component) y por
 * `iconButtonVariants()` (para <Link>, <a>, etc.).
 *
 * Forma única: cuadrado, `rounded-[6px]`, icono tenue que se ilumina en hover
 * elevando la superficie. Separada del componente por la regla del repo:
 * `.ts` para utilities, `.tsx` sólo para componentes (Fast Refresh).
 */
const baseStyles =
  'inline-flex shrink-0 items-center justify-center rounded-[6px] text-[var(--ink-faint)] transition-colors ' +
  'hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed'

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
}

/**
 * Devuelve las clases para un icon-button. Úsalo cuando NO puedes usar
 * `<IconButton>` (típicamente un `<Link to="...">`):
 *
 *   <Link to="/x" className={iconButtonVariants({ size: 'sm' })} aria-label="…">
 *     <Pencil className="h-3.5 w-3.5" aria-hidden />
 *   </Link>
 *
 * Regla: si escribes `h-7 w-7 rounded-[4px] hover:bg-… ` a mano para un icono,
 * estás bypaseando el design system. Usa `<IconButton>` o `iconButtonVariants()`.
 */
export function iconButtonVariants(opts?: { size?: IconButtonSize; className?: string }) {
  const { size = 'md', className } = opts ?? {}
  return cn(baseStyles, sizeStyles[size], className)
}
