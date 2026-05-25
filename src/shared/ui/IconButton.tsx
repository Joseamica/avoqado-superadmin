import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'
import { iconButtonVariants, type IconButtonSize } from './icon-button-variants'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize
}

/**
 * IconButton — el único primitive para botones icon-only: acciones de fila
 * (copy, abrir, menú), cerrar drawer/dialog, toggles de tabla, etc. Cuadrado,
 * `rounded-[6px]`, icono tenue que se ilumina elevando la superficie en hover.
 * El icono va como child (típicamente `h-3.5 w-3.5` / `h-4 w-4`, con `aria-hidden`)
 * y SIEMPRE pasa un `aria-label` para accesibilidad.
 *
 * Para el mismo look en un `<Link>`/`<a>`, usa `iconButtonVariants({ size })`.
 * NUNCA armes un icon button inline con `h-7 w-7 rounded-[4px] hover:bg-…`.
 * `forwardRef` para que sirva en `asChild` de Radix (ej. `<DrawerClose asChild>`).
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(iconButtonVariants({ size }), className)}
      {...props}
    />
  ),
)
IconButton.displayName = 'IconButton'
