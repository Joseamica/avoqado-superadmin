import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * Tooltip del design system. Wrapper minimal sobre Radix.
 *
 * Delay corto (150ms) — Radix por default usa 700ms que se siente lento
 * para un power user 6h/día. Para operadores que scanean iconos en una
 * tabla, queremos que aparezca casi instant.
 *
 * Uso:
 *
 *   <Tooltip content="Owner asignado">
 *     <button>...</button>
 *   </Tooltip>
 *
 * O para mayor control:
 *
 *   <TooltipRoot>
 *     <TooltipTrigger asChild><button>...</button></TooltipTrigger>
 *     <TooltipContent>...</TooltipContent>
 *   </TooltipRoot>
 */

// Provider — se monta una vez al root del app. Centraliza el delay/skipDelay
// de todos los tooltips para que el comportamiento sea consistente.
export const TooltipProvider = TooltipPrimitive.Provider

export const TooltipRoot = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 max-w-[260px] rounded-[4px] border border-[var(--line-strong)] bg-[var(--ink)] px-2.5 py-1.5 text-[11.5px] font-medium leading-snug text-[var(--canvas)] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]',
        'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
        'data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = 'TooltipContent'

/**
 * Helper convenience component — uso típico: tooltip simple sobre un trigger.
 * Para tooltips con contenido rico (markdown, iconos, etc.) usa el patrón
 * `<TooltipRoot><TooltipTrigger /><TooltipContent /></TooltipRoot>` directo.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  )
}
