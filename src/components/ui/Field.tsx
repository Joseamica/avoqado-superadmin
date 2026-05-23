import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, hint, error, id, className, ...props }, ref) => {
    const fieldId = id ?? props.name
    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={fieldId}
          className="text-[12px] font-medium tracking-[-0.005em] text-[var(--ink)]"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={fieldId}
          className={cn(
            'h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[13px]',
            'placeholder:text-[var(--ink-faint)]',
            'focus-visible:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
            'transition-colors',
            error && 'border-[var(--danger)] focus-visible:border-[var(--danger)]',
            className,
          )}
          {...props}
        />
        {error ? (
          <p className="text-[11.5px] text-[var(--danger)]">{error}</p>
        ) : hint ? (
          <p className="text-[11.5px] text-[var(--ink-faint)]">{hint}</p>
        ) : null}
      </div>
    )
  },
)
Field.displayName = 'Field'
