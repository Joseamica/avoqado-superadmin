import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check, Minus } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * Checkbox del design system. Soporta los tres estados que Radix expone:
 * checked (✓), unchecked, e indeterminate (−) — este último se ve cuando
 * un master toggle representa una selección parcial.
 */
export const Checkbox = forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, checked, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    checked={checked}
    className={cn(
      'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-[var(--line-strong)] bg-[var(--canvas)] transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
      'data-[state=checked]:bg-[var(--accent)] data-[state=checked]:border-[var(--accent)]',
      'data-[state=indeterminate]:bg-[var(--accent)] data-[state=indeterminate]:border-[var(--accent)]',
      'disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="text-[var(--canvas)]">
      {checked === 'indeterminate' ? (
        <Minus className="h-3 w-3" strokeWidth={3} aria-hidden />
      ) : (
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = 'Checkbox'
