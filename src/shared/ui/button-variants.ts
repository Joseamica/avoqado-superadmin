import { cn } from '@/shared/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

/**
 * Base class para cualquier elemento interactivo que se ve como botón.
 * Compartida por <Button> (component) y por `buttonVariants()` (para <Link>, <a>, etc.).
 *
 * Está separada del componente porque mezclar exports de funciones y
 * componentes en el mismo archivo rompe React Fast Refresh — la regla del
 * repo es: `.ts` para utilities/hooks, `.tsx` sólo para componentes.
 */
const baseStyles =
  'inline-flex items-center justify-center gap-1.5 rounded-[6px] font-medium tracking-[-0.005em] transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:cursor-not-allowed'

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--surface-primary)] text-[var(--on-surface-primary)] hover:bg-[var(--surface-primary-hover)] disabled:opacity-40',
  secondary:
    'bg-transparent text-[var(--ink-muted)] border border-[var(--line-strong)] hover:border-[var(--ink-faint)] hover:text-[var(--ink)]',
  ghost:
    'bg-transparent text-[var(--ink-muted)] hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]',
  danger: 'bg-[var(--danger)] text-[var(--canvas)] hover:opacity-90',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[12px]',
  md: 'h-9 px-3.5 text-[14px]',
  lg: 'h-10 px-4 text-[14px]',
}

/**
 * Devuelve las clases de estilo para un botón. Úsalo cuando NO puedes usar
 * `<Button>` (típicamente porque necesitas `<Link to="...">` de react-router).
 *
 * Ejemplo:
 *   <Link to="/venues/new" className={buttonVariants({ size: 'md' })}>
 *     Nuevo venue
 *   </Link>
 *
 * Regla: si terminas escribiendo `bg-[var(--surface-primary)] ...` o
 * `bg-white ...` a mano en un className, estás bypaseando el design system.
 * Usa `<Button>` o `buttonVariants()` — no hay tercera opción.
 */
export function buttonVariants(opts?: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}) {
  const { variant = 'primary', size = 'md', className } = opts ?? {}
  return cn(baseStyles, variantStyles[variant], sizeStyles[size], className)
}
